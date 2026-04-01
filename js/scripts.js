// ==========================================
// Configurações e Variáveis Globais
// ==========================================

// As credenciais agora são carregadas de js/config.js via objeto WAYMB_CONFIG

let selectedAmount = 0;
let tipAmount = 0;
let tipPercent = 0;
let isCustomTip = false;
let donationType = "unico"; // unico | mensal

// ==========================================
// Inicialização (jQuery e DOMContentLoaded)
// ==========================================

jQuery(function($){
    $(document).ready(function() {
        // Smooth Scroll
        $('a[href^="#"]').on('click', function(e) {
          e.preventDefault();
          var id = $(this).attr('href'),
              targetOffset = $(id).offset().top;
          $('html, body').animate({ 
              scrollTop: targetOffset - 60
          }, 1000);
        });

        // Mobile Menu
        $('.menu-mobile, .close-menu').click(function(){
            $('.nav-mobile').toggleClass('active');
        });

        // Modal Toggle (Botão Quero Ajudar)
        $('.btn-ajudar, .fora-modal, .close-modal').click(function(e){
            e.preventDefault();
            $('.modal-doar').toggleClass('open');
        });
    });
});

document.addEventListener("DOMContentLoaded", () => {
    // Carrega script de confetti
    let script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js";
    document.head.appendChild(script);

    // Inicializa animações
    addShakeStyles();
    startShakingGift();
    atualizarBarra();
    
    // Inicializa lógica do formulário
    initDonationForm();
});

// ==========================================
// Lógica do Formulário de Doação (Refatorado)
// ==========================================

function initDonationForm() {
    console.log("Iniciando initDonationForm...");

    // ---------------------------------------------------------
    // 1. Mapeamento de Elementos DOM
    // ---------------------------------------------------------
    const elements = {
        btnValores: document.querySelectorAll(".btn-valor"),
        customInput: document.getElementById("custom-amount-input"),
        valorDisplayFinal: document.getElementById("valor-display-final"),
        btnTotalDisplay: document.getElementById("btn-total-display"),
        
        tipSlider: document.getElementById("tip-slider"),
        tipPercentageDisplay: document.getElementById("tip-percentage-display"),
        tipAmountDisplay: document.getElementById("tip-value-display"),
        toggleCustomTip: document.getElementById("toggle-custom-tip"),
        customTipWrapper: document.getElementById("custom-tip-wrapper"),
        customTipInput: document.getElementById("custom-tip-input"),
        
        btnContinuar: document.getElementById("btn-continuar-pagamento"),
        btnVoltar: document.getElementById("btn-voltar"),
        stepValores: document.getElementById("step-valores"),
        stepDados: document.getElementById("step-dados"),
        stepIndicator1: document.getElementById("step-indicator-1"),
        stepIndicator2: document.getElementById("step-indicator-2"),
        alertBox: document.querySelector(".alert-box"),
        
        form: document.getElementById("waymb-form"),
        btnFinalizar: document.getElementById("btn-finalizar")
    };

    // ---------------------------------------------------------
    // 2. Estado da Aplicação
    // ---------------------------------------------------------
    let state = {
        selectedAmount: 0,
        tipPercent: elements.tipSlider ? parseInt(elements.tipSlider.value) : 5,
        tipAmount: 0,
        isCustomTip: false,
        customTipValue: 0
    };

    // Inicializa tipPercent visualmente se necessário
    if (elements.tipPercentageDisplay) {
        elements.tipPercentageDisplay.innerText = `${state.tipPercent}%`;
    }

    // ---------------------------------------------------------
    // 3. Funções de Cálculo e Atualização UI
    // ---------------------------------------------------------
    
    const updateCalculations = () => {
        // Garante que selectedAmount é número
        let amount = parseFloat(state.selectedAmount);
        if (isNaN(amount) || amount < 0) amount = 0;

        // Calcula Gorjeta
        if (state.isCustomTip) {
            state.tipAmount = state.customTipValue;
        } else {
            state.tipAmount = (amount * state.tipPercent) / 100;
        }
        
        // Garante que tipAmount é número
        if (isNaN(state.tipAmount)) state.tipAmount = 0;

        const total = amount + state.tipAmount;

        // Atualiza UI de Texto
        if (elements.tipAmountDisplay) {
            elements.tipAmountDisplay.innerText = formatCurrency(state.tipAmount);
        }
        
        if (elements.tipPercentageDisplay && state.isCustomTip && amount > 0) {
            const pct = Math.round((state.tipAmount / amount) * 100);
            elements.tipPercentageDisplay.innerText = `${pct}%`;
        } else if (elements.tipPercentageDisplay && !state.isCustomTip) {
            elements.tipPercentageDisplay.innerText = `${state.tipPercent}%`;
        }

        if (elements.btnTotalDisplay) {
            elements.btnTotalDisplay.innerText = formatCurrency(total);
        }

        if (elements.valorDisplayFinal) {
            elements.valorDisplayFinal.innerText = formatCurrency(total);
        }
        
        // Esconde alerta se valor for válido (>= 15)
        if (amount >= 15 && elements.alertBox) {
            elements.alertBox.style.display = "none";
        }
        
        console.log("Estado Atualizado:", { amount, tip: state.tipAmount, total });
    };

    // ---------------------------------------------------------
    // 4. Event Listeners - Valores
    // ---------------------------------------------------------

    // A) Toggle Tipo Doação (Única vs Mensal)
    const toggleButtons = document.querySelectorAll('.donation-type-toggle .toggle-btn');
    const valuesSingle = [25, 40, 50, 100, 200, 300];
    const valuesMonthly = [10, 15, 20, 25, 30, 40]; // Valores estimados para mensal

    toggleButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // UI Update
            toggleButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // State Update
            const type = btn.dataset.type; // unica | mensal
            donationType = type; // Atualiza variável global se necessário, ou usa state
            // state.donationType = type; // Se adicionarmos ao state object
            
            // Atualiza valores dos botões
            const valuesToUse = type === 'mensal' ? valuesMonthly : valuesSingle;
            
            elements.btnValores.forEach((btnVal, index) => {
                if (valuesToUse[index] !== undefined) {
                    const val = valuesToUse[index];
                    btnVal.dataset.valor = val;
                    
                    // Preserva estrutura do badge se existir
                    const badge = btnVal.querySelector('.badge-sugerido');
                    if (badge) {
                         btnVal.innerHTML = `€ ${val} ${badge.outerHTML}`;
                    } else {
                         btnVal.innerHTML = `€ ${val}`;
                    }
                }
            });

            // Seleciona o botão sugerido (índice 2) por padrão ao trocar
            if (elements.btnValores[2]) {
                elements.btnValores[2].click();
            }
        });
    });

    // B) Clique nos Botões de Valor
    elements.btnValores.forEach(btn => {
        btn.addEventListener("click", () => {
            // Atualiza UI dos botões
            elements.btnValores.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");

            // Atualiza Estado
            const val = parseFloat(btn.dataset.valor);
            state.selectedAmount = val;

            // Atualiza Input Customizado (visual apenas)
            if(elements.customInput) {
                // Formata para PT (virgula) para ficar bonito
                elements.customInput.value = val.toFixed(2).replace('.', ',');
            }
            
            updateCalculations();
        });
    });

    // B) Input de Valor Personalizado
    if (elements.customInput) {
        elements.customInput.addEventListener("input", (e) => {
            // Remove seleção dos botões pois o usuário está digitando
            elements.btnValores.forEach(b => b.classList.remove("selected"));
            
            // Limpa caracteres inválidos, permite números e uma vírgula
            let rawValue = e.target.value.replace(/[^0-9,]/g, '');
            
            // Corrige múltiplas vírgulas
            const parts = rawValue.split(',');
            if (parts.length > 2) {
                 rawValue = parts[0] + ',' + parts.slice(1).join('');
            }
            
            // Atualiza o valor no input se tiver mudado (para impedir chars invalidos)
            if (e.target.value !== rawValue) {
                e.target.value = rawValue;
            }

            // Converte para float para o estado (vírgula vira ponto)
            let valStr = rawValue.replace(',', '.');
            let val = parseFloat(valStr);
            
            if (isNaN(val)) val = 0;
            
            state.selectedAmount = val;
            updateCalculations();
        });
        
        // Limpa input ao focar se for 0 ou placeholder
        elements.customInput.addEventListener("focus", (e) => {
            if (e.target.value === "0,00" || e.target.value === "0") {
                e.target.value = "";
            }
        });
    }

    // ---------------------------------------------------------
    // 5. Event Listeners - Gorjeta
    // ---------------------------------------------------------

    // Slider
    if (elements.tipSlider) {
        elements.tipSlider.addEventListener("input", (e) => {
            state.tipPercent = parseInt(e.target.value) || 0;
            state.isCustomTip = false;
            
            // UI Toggle Reset
            if (elements.customTipWrapper) elements.customTipWrapper.style.display = "none";
            if (elements.toggleCustomTip) elements.toggleCustomTip.innerText = "Inserir contribuição personalizada";
            
            updateCalculations();
        });
    }

    // Toggle Custom Tip
    if (elements.toggleCustomTip) {
        elements.toggleCustomTip.addEventListener("click", (e) => {
            e.preventDefault();
            if (elements.customTipWrapper.style.display === "none") {
                // Ativar modo custom
                elements.customTipWrapper.style.display = "block";
                elements.toggleCustomTip.innerText = "Usar porcentagem (%)";
                state.isCustomTip = true;
                if(elements.customTipInput) elements.customTipInput.focus();
            } else {
                // Voltar para slider
                elements.customTipWrapper.style.display = "none";
                elements.toggleCustomTip.innerText = "Inserir contribuição personalizada";
                state.isCustomTip = false;
                // Resgata valor do slider
                if(elements.tipSlider) state.tipPercent = parseInt(elements.tipSlider.value) || 0;
                updateCalculations();
            }
        });
    }

    // Input Custom Tip
    if (elements.customTipInput) {
        elements.customTipInput.addEventListener("input", (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val) || val < 0) val = 0;
            state.customTipValue = val;
            state.isCustomTip = true;
            updateCalculations();
        });
    }

    // ---------------------------------------------------------
    // 6. Navegação (Steps)
    // ---------------------------------------------------------

    if (elements.btnContinuar) {
        elements.btnContinuar.addEventListener("click", (e) => {
            e.preventDefault();
            console.log("Tentando avançar. Valor:", state.selectedAmount);

            if (state.selectedAmount < 15) {
                if(elements.alertBox) {
                    elements.alertBox.innerHTML = '<span class="alert-icon">⚠</span> O valor mínimo da doação é € 15,00';
                    elements.alertBox.style.display = "flex";
                    elements.alertBox.classList.add("shake-animation"); 
                    setTimeout(() => elements.alertBox.classList.remove("shake-animation"), 500);
                }
                return;
            }

            if(elements.stepValores && elements.stepDados) {
                elements.stepValores.style.display = "none";
                elements.stepDados.style.display = "block";
                
                if(elements.stepIndicator1 && elements.stepIndicator2) {
                    elements.stepIndicator1.classList.remove("active");
                    elements.stepIndicator1.classList.add("completed");
                    elements.stepIndicator2.classList.add("active");
                }
                
                // Scroll para o topo do form
                elements.stepDados.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    if (elements.btnVoltar) {
        elements.btnVoltar.addEventListener("click", (e) => {
            e.preventDefault();
            if(elements.stepValores && elements.stepDados) {
                elements.stepDados.style.display = "none";
                elements.stepValores.style.display = "block"; 
                
                if(elements.stepIndicator1 && elements.stepIndicator2) {
                    elements.stepIndicator2.classList.remove("active");
                    elements.stepIndicator1.classList.add("active");
                    elements.stepIndicator1.classList.remove("completed");
                }
            }
        });
    }

    // ---------------------------------------------------------
    // 7. Submit do Formulário
    // ---------------------------------------------------------
    if (elements.form) {
        elements.form.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const submitBtn = elements.form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = "Processando...";

            // Coleta dados
            const payerName = document.getElementById("payer-name").value.trim();
            const payerNif = document.getElementById("payer-nif").value.trim();
            const payerPhone = document.getElementById("payer-phone").value.trim();
            const payerEmail = document.getElementById("payer-email").value.trim();
            
            const paymentMethodInput = document.querySelector('input[name="payment_method"]:checked');
            const paymentMethod = paymentMethodInput ? paymentMethodInput.value : "mbway";

            // Validações Básicas
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
                alert("Email inválido.");
                resetBtn(submitBtn, originalText);
                return;
            }

            // Tratamento NIF
            let cleanNif = payerNif.replace(/\D/g, '');
            if (cleanNif.length > 0) {
                if (cleanNif.length !== 9 || !isValidNIF(cleanNif)) {
                    if (!confirm(`O NIF ${cleanNif} parece inválido. Deseja enviar mesmo assim?`)) {
                        resetBtn(submitBtn, originalText);
                        return;
                    }
                    // Se o usuário confirmou, envia o NIF mesmo que pareça inválido (API decide)
                }
            }

            // Tratamento Telefone
            let cleanPhone = payerPhone.replace(/\D/g, '');
            
            // Remove prefixo 351 se existir (para compatibilidade com input +351)
            if (cleanPhone.startsWith('351') && cleanPhone.length === 12) {
                cleanPhone = cleanPhone.substring(3);
            }

            if (cleanPhone.length !== 9) {
                alert("Telefone deve ter 9 dígitos (ex: 912345678).");
                resetBtn(submitBtn, originalText);
                return;
            }

            // Payload API (Seguro - Sem credenciais)
            const totalToPay = state.selectedAmount + state.tipAmount;
            
            // Captura Metadados para Tracking (AdBlock Safe)
            const metadata = {
                fbp: getCookie('_fbp'),
                fbc: getCookie('_fbc'),
                utm_source: getUrlParameter('utm_source'),
                utm_campaign: getUrlParameter('utm_campaign'),
                utm_medium: getUrlParameter('utm_medium'),
                utm_content: getUrlParameter('utm_content'),
                utm_term: getUrlParameter('utm_term')
            };

            const payload = {
                // Credenciais removidas daqui. O backend irá inseri-las.
                amount: totalToPay,
                method: paymentMethod,
                payer: {
                    name: payerName,
                    phone: cleanPhone,
                    email: payerEmail
                },
                metadata: metadata // Envia dados de tracking
            };
            
            // Adiciona document apenas se tiver NIF válido
            if(cleanNif) {
                payload.payer.document = cleanNif;
            }

            try {
                console.log("Enviando payload:", payload);
                const response = await fetch(WAYMB_CONFIG.API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                console.log("Resposta API:", result);

                if (response.ok) {
                    handleSuccess(result, paymentMethod, cleanPhone, totalToPay);
                } else {
                    // Se for erro de criação de pagamento no MB WAY
                    if (paymentMethod === 'mbway' && result.error && result.error.includes("Payment creation failed")) {
                        handleError("Falha ao iniciar pagamento MB WAY. Verifique se o número tem MB WAY ativo ou tente Multibanco.", totalToPay, cleanPhone);
                    } else {
                        handleError(result.message || result.error || "Erro desconhecido na API", totalToPay, cleanPhone);
                    }
                }
            } catch (error) {
                console.error("Erro Fetch:", error);
                handleError("Erro de conexão.", totalToPay, cleanPhone);
            } finally {
                resetBtn(submitBtn, originalText);
            }
        });
    }
    
    // ---------------------------------------------------------
    // 8. Botão Finalizar (Upsell Redirect)
    // ---------------------------------------------------------
    if (elements.btnFinalizar) {
        elements.btnFinalizar.addEventListener("click", (e) => {
            e.preventDefault();
            // Como não conseguimos confirmar o pagamento via API (sem polling),
            // assumimos que se o usuário clicou aqui, ele pagou/anotou a ref.
            window.location.href = "upsell.html";
        });
    }

    // Helpers internos do Form
    function resetBtn(btn, text) {
        btn.disabled = false;
        btn.innerText = text;
    }

    function handleSuccess(result, method, phone, amount) {
        elements.stepDados.style.display = "none";
        const stepSucesso = document.getElementById("step-sucesso");
        if (stepSucesso) {
            stepSucesso.style.display = "block";
            document.querySelector(".steps-indicator").style.display = "none";
            
            // Exibir dados Multibanco/MBWay
            if(method === "multibanco") {
                const mbData = document.getElementById("multibanco-data");
                if(mbData) {
                    mbData.style.display = "block";
                    document.getElementById("mb-entity").innerText = result.entity || "-----";
                    document.getElementById("mb-reference").innerText = result.reference || "---";
                    document.getElementById("mb-amount").innerText = formatCurrency(result.amount || amount);
                }
            } else {
                const mbwayData = document.getElementById("mbway-data");
                if(mbwayData) mbwayData.style.display = "block";
            }
            
            showSuccessNotification();

            // Integração Facebook Pixel (Purchase)
            if (typeof fbq === 'function') {
                try {
                    const transactionId = result.reference || "REF_" + Date.now();
                    fbq('track', 'Purchase', {
                        value: amount,
                        currency: 'EUR',
                        content_ids: [transactionId],
                        content_type: 'product'
                    }, { eventID: transactionId }); // <--- DEDUPLICAÇÃO
                    console.log("Evento Facebook Purchase disparado com eventID:", transactionId);
                } catch (e) {
                    console.error("Erro ao disparar Facebook Pixel:", e);
                }
            }

            // Integração UTMIFY (Disparo de Conversão e Pedido Gerado)
            if (window.utmify) {
                try {
                    // Dispara evento padrão de conversão (Purchase)
                    window.utmify("conversion", {
                        value: amount,
                        currency: "EUR",
                        transaction_id: result.reference || "REF_" + Date.now()
                    });

                    // Dispara evento específico de Pedido Gerado (Custom Event)
                    window.utmify("PedidoGerado", {
                        value: amount,
                        currency: "EUR",
                        transaction_id: result.reference || "REF_" + Date.now(),
                        payment_method: method
                    });

                    console.log("Eventos UTMIFY disparados: conversion e PedidoGerado");
                } catch (e) {
                    console.error("Erro ao disparar UTMIFY:", e);
                }
            }

            // Integração Pushcut (Notificação)
            try {
                const pushcutUrl = "https://api.pushcut.io/oSrZeK-p7TQXRkAgXTUAG/notifications/Don";
                fetch(pushcutUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        title: "Novo Pedido Gerado!",
                        text: `Valor: € ${amount} | Método: ${method} | Ref: ${result.reference || 'N/A'}`,
                        input: JSON.stringify({
                            amount: amount,
                            method: method,
                            reference: result.reference,
                            email: result.email || "N/A"
                        })
                    })
                }).then(response => {
                    if (response.ok) {
                        console.log("Notificação Pushcut enviada com sucesso.");
                    } else {
                        console.warn("Falha ao enviar notificação Pushcut:", response.status);
                    }
                }).catch(err => {
                    console.error("Erro na requisição Pushcut:", err);
                });
            } catch (e) {
                console.error("Erro geral Pushcut:", e);
            }

            // Trava botão por 10s (A aguardar pagamento...)
            if (elements.btnFinalizar) {
                const originalText = elements.btnFinalizar.innerText || "Concluir";
                
                // Estado inicial travado
                elements.btnFinalizar.innerText = "A aguardar pagamento...";
                elements.btnFinalizar.disabled = true;
                elements.btnFinalizar.style.opacity = "0.7";
                elements.btnFinalizar.style.cursor = "not-allowed";
                
                // Destrava após 20 segundos
                setTimeout(() => {
                    elements.btnFinalizar.innerText = originalText;
                    elements.btnFinalizar.disabled = false;
                    elements.btnFinalizar.style.opacity = "1";
                    elements.btnFinalizar.style.cursor = "pointer";
                }, 20000);
            }
        }
    }

    function handleError(msg, amount, phone) {
        alert(`Erro ao processar pagamento: ${msg}\n\nPor favor, tente novamente ou escolha outro método.`);
    }

    // Inicialização Final
    // Seleciona o botão padrão se houver
    const selectedBtn = document.querySelector(".btn-valor.selected");
    if(selectedBtn) {
        selectedBtn.click(); // Simula clique para carregar estado inicial
    } else {
        updateCalculations();
    }
}

// ==========================================
// Funções Auxiliares
// ==========================================

function formatCurrency(valor) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" }).format(valor);
}

// Validação de NIF (Modulo 11)
function isValidNIF(nif) {
    if (!nif || nif.length !== 9) return false;
    const addedCheckDigit = parseInt(nif.charAt(8));
    let sum = 0;
    for (let i = 0; i < 8; i++) {
        sum += parseInt(nif.charAt(i)) * (9 - i);
    }
    const remainder = sum % 11;
    let checkDigit = (remainder < 2) ? 0 : 11 - remainder;
    return checkDigit === addedCheckDigit;
}

// Funções Auxiliares de Tracking
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Persistência de UTMs (LocalStorage)
function saveUtms() {
    const params = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    params.forEach(param => {
        const val = getUrlParameter(param);
        if (val) {
            localStorage.setItem(param, val);
        }
    });
}

function getUtm(name) {
    // 1. Prioridade: URL
    let val = getUrlParameter(name);
    if (val) return val;
    
    // 2. Fallback: LocalStorage
    return localStorage.getItem(name) || '';
}

// Animação Confetti
function showSuccessNotification(element) {
    setTimeout(() => {
        if(typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }, 100);
}

// Animação Shake Gift
function shakeGift() {
    const giftImage = document.querySelector('.sc-tagGq');
    if(giftImage) {
        giftImage.classList.add('shake-animation');
        setTimeout(() => {
            giftImage.classList.remove('shake-animation');
        }, 1000);
    }
}
  
function addShakeStyles() {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes shake {
        0% { transform: rotate(0deg); }
        10% { transform: rotate(-10deg); }
        20% { transform: rotate(10deg); }
        30% { transform: rotate(-10deg); }
        40% { transform: rotate(10deg); }
        50% { transform: rotate(-5deg); }
        60% { transform: rotate(5deg); }
        70% { transform: rotate(-3deg); }
        80% { transform: rotate(3deg); }
        90% { transform: rotate(-1deg); }
        100% { transform: rotate(0deg); }
      }
      .shake-animation {
        animation: shake 1s ease;
        transform-origin: center center;
      }
    `;
    document.head.appendChild(styleSheet);
}
  
function startShakingGift() {
    shakeGift();
    setInterval(shakeGift, 5000);
}

// Valores da barra de progresso (Fictício/Simulado)
function atualizarValores() {
    // Pode implementar lógica de fetch aqui se tiver endpoint
}

function atualizarBarra() {
    // Pode implementar lógica de barra aqui
}

setInterval(atualizarValores, 30000);
