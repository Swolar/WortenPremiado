
// As credenciais agora são carregadas de js/config.js via objeto WAYMB_CONFIG

// Configuração do Valor a Pagar (IVA = 22% do pedido)
// Prioridade: 1) localStorage (valor real do checkout), 2) URL param, 3) fallback
const urlParams = new URLSearchParams(window.location.search);
const amountParam = parseFloat(urlParams.get('amount'));
const savedAmount = parseFloat(localStorage.getItem('purchaseAmount'));

const WITHDRAWAL_AMOUNT = !isNaN(savedAmount) && savedAmount > 0 ? savedAmount
                        : !isNaN(amountParam) && amountParam > 0 ? amountParam
                        : 79.00;

const TAX_PERCENT = 0.22;
const TAX_AMOUNT = parseFloat((WITHDRAWAL_AMOUNT * TAX_PERCENT).toFixed(2));

document.addEventListener("DOMContentLoaded", () => {
    // Atualiza o display do valor da taxa
    const displayElement = document.getElementById("tax-amount-display");
    if (displayElement) {
        displayElement.innerText = `€ ${TAX_AMOUNT.toFixed(2).replace('.', ',')}`;
    }

    // Preenche telefone se veio do checkout
    const savedPhone = localStorage.getItem('customerPhone');
    const phoneInput = document.getElementById("upsell-phone");
    if (savedPhone && phoneInput) {
        const clean = savedPhone.replace(/\D/g, '');
        const digits = clean.startsWith('351') ? clean.substring(3) : clean;
        phoneInput.value = "+351 " + digits;
    }

    initUpsellForm();
});

function initUpsellForm() {
    const btnRetirar = document.getElementById("btn-retirar");
    const phoneInput = document.getElementById("upsell-phone");

    // Máscara básica de telefone (fixa o prefixo +351)
    if(phoneInput) {
        // Garante valor inicial correto
        if (!phoneInput.value.startsWith("+351 ")) {
            phoneInput.value = "+351 ";
        }

        phoneInput.addEventListener("input", (e) => {
            let input = e.target.value;

            // Remove o prefixo se existir para pegar apenas os números digitados
            let rawNumbers = input.replace(/^\+351\s?/, '').replace(/\D/g, '');

            // Limita a 9 dígitos (tamanho padrão PT)
            if (rawNumbers.length > 9) {
                rawNumbers = rawNumbers.substring(0, 9);
            }

            // Reconstrói o valor sempre com o prefixo
            e.target.value = "+351 " + rawNumbers;
        });

        // Impede apagar o prefixo
        phoneInput.addEventListener("keydown", (e) => {
            // Se tentar apagar e estiver no limite do prefixo
            if ((e.key === "Backspace" || e.key === "Delete") && e.target.value.length <= 5) {
                e.preventDefault();
            }
        });
    }

    if (btnRetirar) {
        btnRetirar.addEventListener("click", async (e) => {
            e.preventDefault();

            const originalText = btnRetirar.innerText;
            let phone = phoneInput.value.replace(/\D/g, '');

            // Remove prefixo 351 se existir
            if (phone.startsWith('351') && phone.length === 12) {
                phone = phone.substring(3);
            }

            if (phone.length !== 9) {
                alert("Por favor, insira um número de telemóvel válido (9 dígitos).");
                return;
            }

            btnRetirar.disabled = true;
            btnRetirar.innerText = "Processando...";

            // Captura Metadados para Tracking (AdBlock Safe)
            const metadata = {
                fbp: getCookie('_fbp'),
                fbc: getCookie('_fbc'),
                utm_source: getUrlParameter('utm_source') || sessionStorage.getItem('utm_source') || '',
                utm_campaign: getUrlParameter('utm_campaign') || sessionStorage.getItem('utm_campaign') || '',
                utm_medium: getUrlParameter('utm_medium') || sessionStorage.getItem('utm_medium') || '',
                utm_content: getUrlParameter('utm_content') || sessionStorage.getItem('utm_content') || '',
                utm_term: getUrlParameter('utm_term') || sessionStorage.getItem('utm_term') || ''
            };

            // Usa dados reais do cliente salvos no checkout
            const customerName = localStorage.getItem('customerName') || 'Cliente';
            const customerEmail = localStorage.getItem('customerEmail') || 'cliente@exemplo.com';

            // Payload para API
            const payload = {
                amount: TAX_AMOUNT,
                method: "mbway",
                payer: {
                    name: customerName,
                    phone: `+351${phone}`,
                    email: customerEmail
                },
                metadata: metadata
            };

            try {
                const response = await fetch('api/create_transaction.php', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`Server returned ${response.status}: ${text}`);
                }

                const result = await response.json();
                console.log("Resposta Upsell:", result);

                // Pega o ID da transação para polling
                const txnId = result.reference || result.transactionID || result.id;

                // Mostra a tela de carregamento
                const loadingOverlay = document.getElementById("loading-overlay");
                if(loadingOverlay) {
                    loadingOverlay.style.display = "flex";
                }

                // Inicia polling do status
                if (txnId) {
                    pollUpsellStatus(txnId);
                } else {
                    // Fallback: mostra botão manual após 15s
                    setTimeout(() => {
                        const btnConfirmar = document.getElementById("btn-confirmar-pagamento");
                        if (btnConfirmar) {
                            btnConfirmar.style.display = "inline-block";
                        }
                    }, 15000);
                }

            } catch (error) {
                console.error("Erro:", error);
                alert(`Erro de conexão: ${error.message || "Tente novamente."}`);
            } finally {
                btnRetirar.disabled = false;
                btnRetirar.innerText = originalText;
            }
        });
    }
}

// ==========================================
// POLLING DO STATUS (DISPARA TRACKING)
// ==========================================

function pollUpsellStatus(txnId) {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos (5s x 60)

    const pollInterval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(pollInterval);
            const btnConfirmar = document.getElementById("btn-confirmar-pagamento");
            if (btnConfirmar) btnConfirmar.style.display = "inline-block";
            return;
        }

        try {
            const res = await fetch('api/check_status.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: txnId })
            });
            if (!res.ok) return;
            const data = await res.json();

            if (data.status === 'COMPLETED') {
                clearInterval(pollInterval);

                // Esconde botão manual (evita ação duplicada)
                const btnConfirmar = document.getElementById("btn-confirmar-pagamento");
                if (btnConfirmar) btnConfirmar.style.display = "none";

                // Dispara Purchase no browser (Pixel)
                if (typeof fbq === 'function') {
                    fbq('track', 'Purchase', {
                        value: TAX_AMOUNT,
                        currency: 'EUR'
                    }, { eventID: txnId });
                }

                // Atualiza overlay
                const loadingTitle = document.querySelector('.loading-title');
                const loadingText = document.querySelector('.loading-text');
                if (loadingTitle) loadingTitle.textContent = 'Pagamento confirmado!';
                if (loadingText) loadingText.textContent = 'Redirecionando...';

                // Redireciona para obrigado
                setTimeout(() => {
                    window.location.href = 'obrigado.html';
                }, 2000);

            } else if (data.status === 'FAILED' || data.status === 'EXPIRED') {
                clearInterval(pollInterval);
                const loadingOverlay = document.getElementById("loading-overlay");
                if (loadingOverlay) loadingOverlay.style.display = "none";
                alert("Pagamento falhou ou expirou. Tente novamente.");
            }
        } catch(e) { /* silent */ }
    }, 5000);

    // Mostra botão manual como fallback após 20s
    setTimeout(() => {
        const btnConfirmar = document.getElementById("btn-confirmar-pagamento");
        if (btnConfirmar) btnConfirmar.style.display = "inline-block";
    }, 20000);
}

// ==========================================
// HELPERS (TRACKING & COOKIES)
// ==========================================

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}
