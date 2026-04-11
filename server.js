const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const port = 3000;

// ==========================================
// CONFIGURAÇÕES GERAIS E CREDENCIAIS
// ==========================================

// 1. Configurações da WayMB (Pagamento)
const WAYMB_CONFIG = {
    API_URL: "https://api.waymb.com/transactions/create",
    CLIENT_ID: "pokeg574_2f9842b8",
    CLIENT_SECRET: "d3ef473f-a6d8-4b56-9f5c-7208a71e0df6",
    ACCOUNT_EMAIL: "pokeg574@gmail.com"
};

// 2. Configurações Facebook CAPI (Multi-Pixel)
const FB_PIXELS = [
    {
        id: '2057846451722850', 
        token: 'EAAQkCjbaoJUBQnayuKdCCIfXCffFjE6oLDKxx4TUTtvlUlLYbVxJ0RlDtpSbmVZAMZC32bmO0rxbmABQHRwNviKTYRG22ocBo60Ns7cVA0ZAOF0qf4xEClszedGXBpk1IndoXpznvcETvdV0Bqzq4BsaUhomZCZBmsLgKzOz1L9rcwXsaLEE27ReeCZCXZCMQZDZD'
    },
    {
        id: '920534473682926', 
        token: 'EAAUf3vZCz0hwBQvTz20OCddFMiKzzhN9z2dXtBDNhqYtUCty8ZAaq03xZADVZC8HtA4O4BbMqZBqvkyobXKIQyzBd36hdZCyCTg0cBM9ZAOZA52EJ8uQkPtow65ANJiGBvomO7Se9QUUzMLowgGUFFjUGzuji69Ly9JS3IZCMQj8DVXZA7Q1bD7kMcbEZAkFu9zbQZDZD'
    },
    {
        id: '1512612873613159',
        token: 'EAAKtUpuocVEBRL2BNMfdJfsKxKC3wMZCJQ7LpF7QZCkXyclWL5PZBwIBigxRbNZCLunPN606kOauyHYMU9lo9SpBy1gPbWae3j1t5mrDCpmZBcfZCkSfi7itDhmM8RNN4daZASqSvOuJPxAySTvMCnzb6BnuBY84sF0c76QKnysXMnScMzin7mX9DSsIJlpNERB9gZDZD'
    }
];

// 3. Configurações UTMify
const UTMIFY_CONFIG = {
    WEBHOOK_URL: 'https://api.utmify.com.br/v1/postback',
    TOKEN: 'gU6t0sY4gQGV8ZtFIcFB24GTn5FnRxMAe5Uj'
};

// ==========================================
// HELPERS
// ==========================================

function sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function postRequest(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve({ statusCode: res.statusCode, data: json });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(JSON.stringify(data));
        req.end();
    });
}

// ==========================================
// SERVER
// ==========================================

const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Endpoint de API para criar transação
    // Aceita tanto a rota Node quanto a rota PHP (para compatibilidade)
    if ((req.url === '/api/create-transaction' || req.url === '/api/create_transaction.php') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                
                // Validação básica
                if (!data.amount || !data.method || !data.payer) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "Dados incompletos" }));
                    return;
                }

                // Monta Payload Seguro para WayMB
                const waymbPayload = {
                    client_id: WAYMB_CONFIG.CLIENT_ID,
                    client_secret: WAYMB_CONFIG.CLIENT_SECRET,
                    account_email: WAYMB_CONFIG.ACCOUNT_EMAIL,
                    amount: data.amount,
                    method: data.method,
                    payer: data.payer
                };

                // Chama WayMB
                const waymbResponse = await postRequest(WAYMB_CONFIG.API_URL, waymbPayload);

                if (waymbResponse.statusCode >= 200 && waymbResponse.statusCode < 300) {
                    // Sucesso WayMB
                    const waymbData = waymbResponse.data;
                    
                    // Prioriza 'reference' para alinhar com Frontend
                    const transactionId = waymbData.reference 
                                       || (waymbData.transaction && waymbData.transaction.reference)
                                       || (waymbData.transaction && waymbData.transaction.id)
                                       || waymbData.id 
                                       || 'REF_' + Date.now();

                    // Responde ao cliente IMEDIATAMENTE
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(waymbData));

                    // ==========================================
                    // TRACKING EM BACKGROUND (FIRE AND FORGET)
                    // ==========================================
                    
                    // Dados do Usuário Normalizados
                    const email = (data.payer.email || '').trim().toLowerCase();
                    const phone = (data.payer.phone || '').replace(/[^0-9]/g, '');
                    const hashedEmail = email ? sha256(email) : null;
                    const hashedPhone = phone ? sha256(phone) : null;
                    
                    const metadata = data.metadata || {};
                    const userIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
                    const userAgent = req.headers['user-agent'];

                    // 1. Facebook CAPI
                    const eventTime = Math.floor(Date.now() / 1000);
                    
                    FB_PIXELS.forEach(pixel => {
                        if (!pixel.token || pixel.token.includes('INSIRA')) return;

                        const fbPayload = {
                            data: [{
                                event_name: 'Purchase',
                                event_time: eventTime,
                                event_id: transactionId,
                                action_source: 'website',
                                event_source_url: req.headers.referer || 'https://asasdeanjo.pt',
                                user_data: {
                                    em: hashedEmail ? [hashedEmail] : [],
                                    ph: hashedPhone ? [hashedPhone] : [],
                                    client_ip_address: userIp,
                                    client_user_agent: userAgent,
                                    fbp: metadata.fbp || null,
                                    fbc: metadata.fbc || null
                                },
                                custom_data: {
                                    currency: 'EUR',
                                    value: parseFloat(data.amount)
                                }
                            }]
                        };

                        postRequest(`https://graph.facebook.com/v16.0/${pixel.id}/events?access_token=${pixel.token}`, fbPayload)
                            .catch(err => console.error('Erro CAPI:', err.message));
                    });

                    // 2. UTMify Postback
                    const utmifyPayload = {
                        token: UTMIFY_CONFIG.TOKEN,
                        order_id: transactionId,
                        payment_status: "paid",
                        amount: parseFloat(data.amount),
                        currency: "EUR",
                        customer: {
                            name: data.payer.name || 'Doador',
                            email: email,
                            phone: phone,
                            ip: userIp
                        },
                        utms: {
                            utm_source: metadata.utm_source || '',
                            utm_campaign: metadata.utm_campaign || '',
                            utm_medium: metadata.utm_medium || '',
                            utm_content: metadata.utm_content || '',
                            utm_term: metadata.utm_term || ''
                        }
                    };

                    postRequest(UTMIFY_CONFIG.WEBHOOK_URL, utmifyPayload)
                        .catch(err => console.error('Erro UTMify:', err.message));

                } else {
                    // Erro WayMB
                    res.writeHead(waymbResponse.statusCode, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(waymbResponse.data));
                }

            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "Erro interno ou JSON inválido: " + e.message }));
            }
        });
        return;
    }

    // Static Files
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './upsellPTtaxa.html';
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpg'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
        case '.webp': contentType = 'image/webp'; break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT'){
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Error: '+error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
