<?php
// ==========================================
// VERIFICA STATUS E DISPARA TRACKING
// ==========================================

// Credenciais WayMB
define('WAYMB_CLIENT_ID', 'pokeg574_2f9842b8');
define('WAYMB_CLIENT_SECRET', 'd3ef473f-a6d8-4b56-9f5c-7208a71e0df6');

// Facebook CAPI
$fb_pixels = [
    [
        'id' => '2057846451722850',
        'token' => 'EAAQkCjbaoJUBQnayuKdCCIfXCffFjE6oLDKxx4TUTtvlUlLYbVxJ0RlDtpSbmVZAMZC32bmO0rxbmABQHRwNviKTYRG22ocBo60Ns7cVA0ZAOF0qf4xEClszedGXBpk1IndoXpznvcETvdV0Bqzq4BsaUhomZCZBmsLgKzOz1L9rcwXsaLEE27ReeCZCXZCMQZDZD'
    ],
    [
        'id' => '920534473682926',
        'token' => 'EAAUf3vZCz0hwBQvTz20OCddFMiKzzhN9z2dXtBDNhqYtUCty8ZAaq03xZADVZC8HtA4O4BbMqZBqvkyobXKIQyzBd36hdZCyCTg0cBM9ZAOZA52EJ8uQkPtow65ANJiGBvomO7Se9QUUzMLowgGUFFjUGzuji69Ly9JS3IZCMQj8DVXZA7Q1bD7kMcbEZAkFu9zbQZDZD'
    ]
];

// UTMify
define('UTMIFY_WEBHOOK_URL', 'https://api.utmify.com.br/v1/postback');
define('UTMIFY_TOKEN', 'CUgtBZAPTKhCmfHtbtBTT3Q3yk9fRuutmHCh');

// Headers
header("Access-Control-Allow-Origin: https://sem-parar.com");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Use POST"]);
    exit();
}

$input = json_decode(file_get_contents("php://input"), true);

if (empty($input['id'])) {
    http_response_code(400);
    echo json_encode(["error" => "Transaction ID required"]);
    exit();
}

$txnId = $input['id'];

// Validação: impede path traversal e caracteres maliciosos
if (!preg_match('/^[a-zA-Z0-9]{1,64}$/', $txnId)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid transaction ID"]);
    exit();
}

// ==========================================
// 1. CONSULTA STATUS NA WAYMB
// ==========================================

$payload = [
    'client_id' => WAYMB_CLIENT_ID,
    'client_secret' => WAYMB_CLIENT_SECRET,
    'id' => $txnId
];

$ch = curl_init('https://api.waymb.com/transactions/info');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result = json_decode($response, true);

// Log da resposta da WayMB para debug
$log_dir = __DIR__ . '/logs';
if (!is_dir($log_dir)) mkdir($log_dir, 0755, true);
file_put_contents($log_dir . '/waymb_status_' . $txnId . '_' . time() . '.log', json_encode([
    'txnId' => $txnId,
    'httpCode' => $httpCode,
    'response' => $result
], JSON_PRETTY_PRINT));

// Normaliza status: busca em vários caminhos possíveis da resposta
$status = $result['status']
       ?? $result['transaction']['status']
       ?? $result['data']['status']
       ?? '';
$status = strtoupper(trim($status));

// Monta resposta normalizada para o frontend
$frontend_response = $result;
$frontend_response['status'] = $status; // Garante que 'status' está no topo

http_response_code($httpCode ?: 200);
echo json_encode($frontend_response);

// ==========================================
// 2. SE COMPLETED, DISPARA TRACKING (1x só)
// ==========================================

if ($status !== 'COMPLETED') {
    // Log: por que não disparou tracking
    file_put_contents($log_dir . '/tracking_skip_' . $txnId . '.log', json_encode([
        'reason' => 'status_not_completed',
        'status' => $status,
        'raw_status_field' => $result['status'] ?? 'NULL',
        'txnId' => $txnId,
        'time' => date('c')
    ], JSON_PRETTY_PRINT));
    exit();
}

// Verifica se já disparou tracking para essa transação
$pending_dir = __DIR__ . '/pending';
$tracked_dir = __DIR__ . '/tracked';

if (!is_dir($tracked_dir)) {
    mkdir($tracked_dir, 0755, true);
}

// Se já foi tracked, não dispara novamente
if (file_exists($tracked_dir . '/' . $txnId . '.done')) {
    file_put_contents($log_dir . '/tracking_skip_' . $txnId . '_dup.log', json_encode([
        'reason' => 'already_tracked',
        'txnId' => $txnId,
        'time' => date('c')
    ], JSON_PRETTY_PRINT));
    exit();
}

// Carrega dados salvos na criação
$pending_file = $pending_dir . '/' . $txnId . '.json';
if (!file_exists($pending_file)) {
    // Tenta buscar por outros arquivos na pasta pending (fallback)
    $found = false;
    if (is_dir($pending_dir)) {
        foreach (glob($pending_dir . '/*.json') as $f) {
            $tmp = json_decode(file_get_contents($f), true);
            if (($tmp['waymb_id'] ?? '') === $txnId || ($tmp['reference'] ?? '') === $txnId) {
                $pending_file = $f;
                $found = true;
                break;
            }
        }
    }
    if (!$found) {
        file_put_contents($log_dir . '/tracking_fail_' . $txnId . '.log', json_encode([
            'reason' => 'pending_file_not_found',
            'looked_for' => $pending_dir . '/' . $txnId . '.json',
            'pending_count' => is_dir($pending_dir) ? count(glob($pending_dir . '/*.json')) : 0,
            'time' => date('c')
        ], JSON_PRETTY_PRINT));
        exit();
    }
}

$pending = json_decode(file_get_contents($pending_file), true);

// Marca como tracked ANTES de disparar (evita duplicação)
file_put_contents($tracked_dir . '/' . $txnId . '.done', time());

// Fecha conexão com o browser - tracking roda em background
ignore_user_abort(true);
set_time_limit(0);

if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}

// Dados do usuário
$email = strtolower(trim($pending['payer']['email'] ?? ''));
$phone = preg_replace('/[^0-9]/', '', $pending['payer']['phone'] ?? '');
$hashed_email = !empty($email) ? hash('sha256', $email) : null;
$hashed_phone = !empty($phone) ? hash('sha256', $phone) : null;

$metadata = $pending['metadata'] ?? [];
$fbp = $metadata['fbp'] ?? null;
$fbc = $metadata['fbc'] ?? null;
$user_ip = $pending['user_ip'] ?? null;
$user_agent = $pending['user_agent'] ?? null;
$transaction_id = $pending['reference'] ?? $pending['waymb_id'] ?? $pending['transaction_id'] ?? $txnId;
$amount = $pending['amount'];

// ---------------------------------------------------------
// FACEBOOK CAPI (MULTI-PIXEL)
// ---------------------------------------------------------

$event_time = time();

foreach ($fb_pixels as $pixel) {
    if (empty($pixel['token'])) continue;

    $fb_payload = [
        'data' => [
            [
                'event_name' => 'Purchase',
                'event_time' => $event_time,
                'event_id' => $transaction_id,
                'action_source' => 'website',
                'event_source_url' => $pending['referer'] ?? 'https://sem-parar.com',
                'user_data' => [
                    'em' => $hashed_email ? [$hashed_email] : [],
                    'ph' => $hashed_phone ? [$hashed_phone] : [],
                    'client_ip_address' => $user_ip,
                    'client_user_agent' => $user_agent,
                    'fbp' => $fbp,
                    'fbc' => $fbc
                ],
                'custom_data' => [
                    'currency' => 'EUR',
                    'value' => $amount
                ]
            ]
        ]
    ];

    $ch_fb = curl_init('https://graph.facebook.com/v21.0/' . $pixel['id'] . '/events?access_token=' . $pixel['token']);
    curl_setopt($ch_fb, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch_fb, CURLOPT_POST, true);
    curl_setopt($ch_fb, CURLOPT_POSTFIELDS, json_encode($fb_payload));
    curl_setopt($ch_fb, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch_fb, CURLOPT_TIMEOUT, 10);
    $fb_response = curl_exec($ch_fb);
    $fb_code = curl_getinfo($ch_fb, CURLINFO_HTTP_CODE);
    curl_close($ch_fb);

    // Log CAPI para debug
    $log_dir = __DIR__ . '/logs';
    if (!is_dir($log_dir)) mkdir($log_dir, 0755, true);
    file_put_contents($log_dir . '/capi_' . $pixel['id'] . '_' . $transaction_id . '.log', json_encode([
        'pixel' => $pixel['id'],
        'sent' => $fb_payload,
        'response_code' => $fb_code,
        'response' => $fb_response
    ], JSON_PRETTY_PRINT));
}

// ---------------------------------------------------------
// UTMIFY API (formato correto: /api-credentials/orders)
// ---------------------------------------------------------

$now = date('c'); // ISO 8601

$amount_brl = $amount * 5.8; // Conversão EUR → BRL para Utmify
$amount_cents = (int)round($amount_brl * 100);
// Usa o mesmo orderId que foi enviado como pendente (waymb_id)
$utmify_order_id = $pending['waymb_id'] ?? $txnId;

$utmify_payload = [
    "orderId" => $utmify_order_id,
    "platform" => "other",
    "paymentMethod" => "pix",
    "status" => "paid",
    "createdAt" => date('c', $pending['created_at'] ?? time()),
    "approvedDate" => $now,
    "refundedAt" => null,
    "customer" => [
        "name" => $pending['payer']['name'] ?? 'Cliente',
        "email" => $email,
        "phone" => $phone,
        "document" => $pending['payer']['document'] ?? ''
    ],
    "products" => [
        [
            "id" => !empty($pending['products'][0]['id']) ? $pending['products'][0]['id'] : "prod_01",
            "name" => !empty($pending['products'][0]['name']) ? $pending['products'][0]['name'] : "Worten Produto",
            "planId" => "plan_01",
            "planName" => "",
            "quantity" => 1,
            "priceInCents" => $amount_cents
        ]
    ],
    "trackingParameters" => [
        "utm_source" => $metadata['utm_source'] ?? null,
        "utm_medium" => $metadata['utm_medium'] ?? null,
        "utm_campaign" => $metadata['utm_campaign'] ?? null,
        "utm_content" => $metadata['utm_content'] ?? null,
        "utm_term" => $metadata['utm_term'] ?? null
    ],
    "commission" => [
        "totalPriceInCents" => $amount_cents,
        "gatewayFeeInCents" => 0,
        "userCommissionInCents" => $amount_cents
    ]
];

$ch_utm = curl_init('https://api.utmify.com.br/api-credentials/orders');
curl_setopt($ch_utm, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch_utm, CURLOPT_POST, true);
curl_setopt($ch_utm, CURLOPT_POSTFIELDS, json_encode($utmify_payload));
curl_setopt($ch_utm, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-api-token: ' . UTMIFY_TOKEN
]);
curl_setopt($ch_utm, CURLOPT_TIMEOUT, 10);
$utmify_response = curl_exec($ch_utm);
$utmify_code = curl_getinfo($ch_utm, CURLINFO_HTTP_CODE);
curl_close($ch_utm);

// Log para debug
$log_dir = __DIR__ . '/logs';
if (!is_dir($log_dir)) mkdir($log_dir, 0755, true);
file_put_contents($log_dir . '/utmify_' . $transaction_id . '.log', json_encode([
    'sent' => $utmify_payload,
    'response_code' => $utmify_code,
    'response' => $utmify_response
], JSON_PRETTY_PRINT));

// ---------------------------------------------------------
// WEBHOOK RASTREIO (coleta dados para envio de código)
// ---------------------------------------------------------

$rastreio_url = 'https://rastreio-encomendas.vercel.app/api/webhook/waylinx?token=fb01e315-c319-4c9c-86e6-603db3ac7b28';

$shipping = $pending['shipping'] ?? [];
$products = $pending['products'] ?? [];

$rastreio_payload = [
    "order_id" => $transaction_id,
    "status" => "paid",
    "amount" => $amount,
    "currency" => "EUR",
    "paid_at" => $now,
    "customer" => [
        "name" => $pending['payer']['name'] ?? 'Cliente',
        "email" => $email,
        "phone" => $phone,
        "document" => $pending['payer']['document'] ?? ''
    ],
    "shipping" => [
        "address" => $shipping['address'] ?? '',
        "postal_code" => $shipping['postal_code'] ?? '',
        "city" => $shipping['city'] ?? '',
        "country" => $shipping['country'] ?? 'Portugal'
    ],
    "products" => $products
];

$ch_rastreio = curl_init($rastreio_url);
curl_setopt($ch_rastreio, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch_rastreio, CURLOPT_POST, true);
curl_setopt($ch_rastreio, CURLOPT_POSTFIELDS, json_encode($rastreio_payload));
curl_setopt($ch_rastreio, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch_rastreio, CURLOPT_TIMEOUT, 10);
$rastreio_response = curl_exec($ch_rastreio);
$rastreio_code = curl_getinfo($ch_rastreio, CURLINFO_HTTP_CODE);
curl_close($ch_rastreio);

// Log rastreio
file_put_contents($log_dir . '/rastreio_' . $transaction_id . '.log', json_encode([
    'sent' => $rastreio_payload,
    'response_code' => $rastreio_code,
    'response' => $rastreio_response
], JSON_PRETTY_PRINT));

// Limpa arquivo pending
@unlink($pending_file);
