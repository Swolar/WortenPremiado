<?php
// ==========================================
// CONFIGURAÇÕES GERAIS E CREDENCIAIS
// ==========================================

// 1. Configurações da WayMB (Pagamento)
define('WAYMB_API_URL', 'https://api.waymb.com/transactions/create');
define('WAYMB_CLIENT_ID', 'pokeg574_2f9842b8');
define('WAYMB_CLIENT_SECRET', 'd3ef473f-a6d8-4b56-9f5c-7208a71e0df6');
define('WAYMB_ACCOUNT_EMAIL', 'pokeg574@gmail.com');

// 2. Configurações Facebook CAPI (Multi-Pixel)
// Adicione quantos pixels desejar no array abaixo.
$fb_pixels = [
    [
        'id' => '1988037148802788',
        'token' => 'EAAM1mqQqxU0BRFdxk2SHRpNZB7gLLah5tqIImd1TDDCb1cjYJtusDOuq3AkV2Gaam3c8TWWNacBTShMAeSWHjGNOAPAEjNu9aNnx97dlfGdQY4fUDidfPm5iy3CZCGpTpboe9czxNyQaa54JKD6xSUtzyB7MBCmQAXTlNyIPTngbpa0j3FBycOAmDuvJ20FgZDZD'
    ],
    [
        'id' => '1512612873613159',
        'token' => 'EAAKtUpuocVEBRL2BNMfdJfsKxKC3wMZCJQ7LpF7QZCkXyclWL5PZBwIBigxRbNZCLunPN606kOauyHYMU9lo9SpBy1gPbWae3j1t5mrDCpmZBcfZCkSfi7itDhmM8RNN4daZASqSvOuJPxAySTvMCnzb6BnuBY84sF0c76QKnysXMnScMzin7mX9DSsIJlpNERB9gZDZD'
    ]
];

// 3. Configurações UTMify
define('UTMIFY_WEBHOOK_URL', 'https://api.utmify.com.br/v1/postback');
define('UTMIFY_TOKEN', 'CUgtBZAPTKhCmfHtbtBTT3Q3yk9fRuutmHCh'); // Token de Integração (Postback)

// ==========================================
// CABEÇALHOS E SEGURANÇA
// ==========================================

// Permite CORS (Cross-Origin Resource Sharing)
header("Access-Control-Allow-Origin: https://premio-especial.com");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Responde a requisições OPTIONS (Preflight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Verifica se é um POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Método não permitido. Use POST."]);
    exit();
}

// ==========================================
// RATE LIMITING (max 10 requests por IP por minuto)
// ==========================================

$rate_dir = __DIR__ . '/rate_limit';
if (!is_dir($rate_dir)) mkdir($rate_dir, 0755, true);

$client_ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rate_file = $rate_dir . '/' . md5($client_ip) . '.json';

$rate_data = file_exists($rate_file) ? json_decode(file_get_contents($rate_file), true) : ['count' => 0, 'start' => time()];

if (time() - $rate_data['start'] > 60) {
    $rate_data = ['count' => 0, 'start' => time()];
}

$rate_data['count']++;
file_put_contents($rate_file, json_encode($rate_data));

if ($rate_data['count'] > 10) {
    http_response_code(429);
    echo json_encode(["error" => "Muitas requisições. Aguarde 1 minuto."]);
    exit();
}

// ==========================================
// PROCESSAMENTO DA REQUISIÇÃO
// ==========================================

// Lê e decodifica o JSON recebido
$input = file_get_contents("php://input");
$data = json_decode($input, true);

// Validação básica
if (!isset($data['amount']) || !isset($data['method']) || !isset($data['payer'])) {
    http_response_code(400);
    echo json_encode(["error" => "Dados incompletos. 'amount', 'method' e 'payer' são obrigatórios."]);
    exit();
}

// ---------------------------------------------------------
// 1. CRIAÇÃO DA TRANSAÇÃO NA WAYMB (PRINCIPAL)
// ---------------------------------------------------------

$waymb_payload = [
    'client_id' => WAYMB_CLIENT_ID,
    'client_secret' => WAYMB_CLIENT_SECRET,
    'account_email' => WAYMB_ACCOUNT_EMAIL,
    'amount' => $data['amount'],
    'method' => $data['method'],
    'payer' => $data['payer']
];

$ch = curl_init(WAYMB_API_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($waymb_payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 12);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// Se a WayMB falhar, retorna erro IMEDIATAMENTE e não dispara tracking
if ($httpCode < 200 || $httpCode >= 300 || $curlError) {
    http_response_code($httpCode ?: 500);
    echo json_encode([
        "error" => "Erro no processamento do pagamento.",
        "details" => $curlError ?: $response
    ]);
    exit(); // Encerra script, nada é enviado ao Facebook/UTMify
}

// Decodifica resposta da WayMB para pegar IDs
$waymb_data = json_decode($response, true);

// LOG: Salva resposta completa da WayMB para debug
$log_dir = __DIR__ . '/logs';
if (!is_dir($log_dir)) mkdir($log_dir, 0755, true);
file_put_contents($log_dir . '/waymb_create_' . time() . '.log', json_encode([
    'httpCode' => $httpCode,
    'raw_response' => $response,
    'parsed' => $waymb_data,
    'method' => $data['method'] ?? '',
    'amount' => $data['amount'] ?? ''
], JSON_PRETTY_PRINT));

// Pega o ID principal (para polling de status) — WayMB usa 'id' para consultar
$waymb_id = $waymb_data['id']
         ?? $waymb_data['transaction']['id']
         ?? $waymb_data['transactionID']
         ?? null;

// Pega reference separado (para eventID do Pixel/CAPI)
$waymb_reference = $waymb_data['reference']
                ?? $waymb_data['transaction']['reference']
                ?? $waymb_id
                ?? 'REF_' . time();

// waymb_id = ID para polling (o que o frontend envia para check_status)
// waymb_reference = reference para eventID do Pixel/CAPI

$pending_dir = __DIR__ . '/pending';
if (!is_dir($pending_dir)) {
    mkdir($pending_dir, 0755, true);
}

$pending_data = [
    'waymb_id' => $waymb_id,
    'reference' => $waymb_reference,
    'amount' => (float)$data['amount'],
    'payer' => $data['payer'],
    'shipping' => $data['shipping'] ?? [],
    'products' => $data['products'] ?? [],
    'metadata' => $data['metadata'] ?? [],
    'user_ip' => $_SERVER['REMOTE_ADDR'] ?? null,
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
    'referer' => $_SERVER['HTTP_REFERER'] ?? null,
    'created_at' => time()
];

// Salva com waymb_id como chave (é o que check_status.php usa para buscar)
$pending_key = $waymb_id ?? $waymb_reference ?? 'TXN_' . time();
file_put_contents($pending_dir . '/' . $pending_key . '.json', json_encode($pending_data));

// Retorna resposta da WayMB ao frontend com campos normalizados
$frontend_response = $waymb_data;
$frontend_response['transactionID'] = $waymb_id;
$frontend_response['reference'] = $waymb_reference;

http_response_code($httpCode);
echo json_encode($frontend_response);

// ---------------------------------------------------------
// UTMIFY: Envia venda PENDENTE (roda após resposta ao browser)
// ---------------------------------------------------------
ignore_user_abort(true);
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}

// ---------------------------------------------------------
// REMARKETING: Notifica LoopeySend de pedido pendente
// ---------------------------------------------------------
$rastreio_pending_url = 'https://rastreio-encomendas.vercel.app/api/webhook/pending?token=fb01e315-c319-4c9c-86e6-603db3ac7b28';

$pending_payload_rastreio = [
    "transaction_id" => $waymb_id,
    "status" => "pending",
    "amount" => (float)$data['amount'],
    "customer" => [
        "name" => $data['payer']['name'] ?? 'Cliente',
        "email" => strtolower(trim($data['payer']['email'] ?? '')),
        "phone" => preg_replace('/[^0-9]/', '', $data['payer']['phone'] ?? '')
    ],
    "shipping" => $data['shipping'] ?? [],
    "products" => $data['products'] ?? [],
    "checkout_url" => $_SERVER['HTTP_REFERER'] ?? 'https://sem-parar.com'
];

$ch_pend = curl_init($rastreio_pending_url);
curl_setopt($ch_pend, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch_pend, CURLOPT_POST, true);
curl_setopt($ch_pend, CURLOPT_POSTFIELDS, json_encode($pending_payload_rastreio));
curl_setopt($ch_pend, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch_pend, CURLOPT_TIMEOUT, 5);
$pend_resp = curl_exec($ch_pend);
curl_close($ch_pend);

// Log remarketing
file_put_contents($log_dir . '/remarketing_pending_' . $pending_key . '.log', json_encode([
    'sent' => $pending_payload_rastreio,
    'response' => $pend_resp
], JSON_PRETTY_PRINT));

$utm_meta = $data['metadata'] ?? [];
$utm_prods = $data['products'] ?? [];
$utm_amount_brl = (float)$data['amount'] * 5.8;
$utm_cents = (int)round($utm_amount_brl * 100);

$utm_body = json_encode([
    "orderId" => $pending_key,
    "platform" => "other",
    "paymentMethod" => "pix",
    "status" => "waiting_payment",
    "createdAt" => date('c'),
    "approvedDate" => null,
    "refundedAt" => null,
    "customer" => [
        "name" => $data['payer']['name'] ?? 'Cliente',
        "email" => strtolower(trim($data['payer']['email'] ?? '')),
        "phone" => preg_replace('/[^0-9]/', '', $data['payer']['phone'] ?? ''),
        "document" => $data['payer']['document'] ?? ''
    ],
    "products" => [[
        "id" => isset($utm_prods[0]['id']) ? $utm_prods[0]['id'] : "prod_01",
        "name" => isset($utm_prods[0]['name']) ? $utm_prods[0]['name'] : "Worten Produto",
        "planId" => "plan_01",
        "planName" => "",
        "quantity" => 1,
        "priceInCents" => $utm_cents
    ]],
    "trackingParameters" => [
        "utm_source" => isset($utm_meta['utm_source']) ? $utm_meta['utm_source'] : null,
        "utm_medium" => isset($utm_meta['utm_medium']) ? $utm_meta['utm_medium'] : null,
        "utm_campaign" => isset($utm_meta['utm_campaign']) ? $utm_meta['utm_campaign'] : null,
        "utm_content" => isset($utm_meta['utm_content']) ? $utm_meta['utm_content'] : null,
        "utm_term" => isset($utm_meta['utm_term']) ? $utm_meta['utm_term'] : null
    ],
    "commission" => [
        "totalPriceInCents" => $utm_cents,
        "gatewayFeeInCents" => 0,
        "userCommissionInCents" => $utm_cents
    ]
]);

$ch_utm = curl_init('https://api.utmify.com.br/api-credentials/orders');
curl_setopt($ch_utm, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch_utm, CURLOPT_POST, true);
curl_setopt($ch_utm, CURLOPT_POSTFIELDS, $utm_body);
curl_setopt($ch_utm, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'x-api-token: ' . UTMIFY_TOKEN]);
curl_setopt($ch_utm, CURLOPT_TIMEOUT, 5);
$utm_resp = curl_exec($ch_utm);
$utm_code = curl_getinfo($ch_utm, CURLINFO_HTTP_CODE);
curl_close($ch_utm);

file_put_contents($log_dir . '/utmify_pending_' . $pending_key . '.log', json_encode([
    'response_code' => $utm_code, 'response' => $utm_resp
], JSON_PRETTY_PRINT));
