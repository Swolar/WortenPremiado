<?php
// ==========================================
// CRON: Verifica transações pendentes e dispara tracking
// Rodar a cada 2-3 minutos via cron job
// ==========================================

// Impede acesso externo (só cron ou CLI)
$allowed = php_sapi_name() === 'cli';
if (!$allowed) {
    // Permite via HTTP com token secreto
    $token = $_GET['token'] ?? '';
    if (!hash_equals('xK9mT4vR2pL7nQ8wF3jB6hY1cA5eD0gS', $token)) {
        http_response_code(403);
        echo json_encode(["error" => "Forbidden"]);
        exit();
    }
}

// Configurações
define('WAYMB_CLIENT_ID', 'pokeg574_2f9842b8');
define('WAYMB_CLIENT_SECRET', 'd3ef473f-a6d8-4b56-9f5c-7208a71e0df6');

$pending_dir = __DIR__ . '/pending';
$tracked_dir = __DIR__ . '/tracked';
$log_dir = __DIR__ . '/logs';

if (!is_dir($pending_dir)) { echo "No pending dir\n"; exit(); }
if (!is_dir($tracked_dir)) mkdir($tracked_dir, 0755, true);
if (!is_dir($log_dir)) mkdir($log_dir, 0755, true);

$files = glob($pending_dir . '/*.json');
$results = [];

foreach ($files as $file) {
    $pending = json_decode(file_get_contents($file), true);
    $key = basename($file, '.json');

    // Pula se já foi tracked
    if (file_exists($tracked_dir . '/' . $key . '.done')) {
        @unlink($file); // Limpa pending já processado
        continue;
    }

    // Pula se tem mais de 24h (expirado)
    $created = $pending['created_at'] ?? 0;
    if (time() - $created > 86400) {
        @unlink($file); // Limpa expirado
        $results[] = ['key' => $key, 'action' => 'expired_removed'];
        continue;
    }

    // Consulta status na WayMB
    $waymb_id = $pending['waymb_id'] ?? $key;

    $payload = [
        'client_id' => WAYMB_CLIENT_ID,
        'client_secret' => WAYMB_CLIENT_SECRET,
        'id' => $waymb_id
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

    // Normaliza status
    $status = $result['status']
           ?? $result['transaction']['status']
           ?? $result['data']['status']
           ?? '';
    $status = strtoupper(trim($status));

    if ($status === 'COMPLETED') {
        // DISPARA TRACKING via include do check_status logic
        $results[] = ['key' => $key, 'waymb_id' => $waymb_id, 'action' => 'completed_tracking'];

        // Marca como tracked
        file_put_contents($tracked_dir . '/' . $key . '.done', time());

        // Carrega configs para tracking
        dispatchTracking($pending, $key, $log_dir);

        // Limpa pending
        @unlink($file);

    } elseif ($status === 'DECLINED' || $status === 'EXPIRED' || $status === 'FAILED') {
        @unlink($file);
        $results[] = ['key' => $key, 'action' => 'removed_' . strtolower($status)];
    } else {
        $results[] = ['key' => $key, 'status' => $status, 'action' => 'still_pending'];
    }
}

echo json_encode(['processed' => count($files), 'results' => $results], JSON_PRETTY_PRINT);

// ==========================================
// FUNÇÃO: Dispara tracking completo
// ==========================================
function dispatchTracking($pending, $key, $log_dir) {

    // Facebook CAPI
    $fb_pixels = [
        ['id' => '1988037148802788', 'token' => 'EAAM1mqQqxU0BRFdxk2SHRpNZB7gLLah5tqIImd1TDDCb1cjYJtusDOuq3AkV2Gaam3c8TWWNacBTShMAeSWHjGNOAPAEjNu9aNnx97dlfGdQY4fUDidfPm5iy3CZCGpTpboe9czxNyQaa54JKD6xSUtzyB7MBCmQAXTlNyIPTngbpa0j3FBycOAmDuvJ20FgZDZD']
    ];

    $email = strtolower(trim($pending['payer']['email'] ?? ''));
    $phone = preg_replace('/[^0-9]/', '', $pending['payer']['phone'] ?? '');
    $hashed_email = !empty($email) ? hash('sha256', $email) : null;
    $hashed_phone = !empty($phone) ? hash('sha256', $phone) : null;
    $metadata = $pending['metadata'] ?? [];
    $transaction_id = $pending['reference'] ?? $pending['waymb_id'] ?? $key;
    $amount = $pending['amount'];
    $products = $pending['products'] ?? [];
    $event_time = time();

    // FACEBOOK CAPI
    foreach ($fb_pixels as $pixel) {
        if (empty($pixel['token'])) continue;

        $fb_payload = [
            'data' => [[
                'event_name' => 'Purchase',
                'event_time' => $event_time,
                'event_id' => $transaction_id,
                'action_source' => 'website',
                'event_source_url' => $pending['referer'] ?? 'https://sem-parar.com',
                'user_data' => [
                    'em' => $hashed_email ? [$hashed_email] : [],
                    'ph' => $hashed_phone ? [$hashed_phone] : [],
                    'client_ip_address' => $pending['user_ip'] ?? null,
                    'client_user_agent' => $pending['user_agent'] ?? null,
                    'fbp' => $metadata['fbp'] ?? null,
                    'fbc' => $metadata['fbc'] ?? null
                ],
                'custom_data' => [
                    'currency' => 'EUR',
                    'value' => $amount
                ]
            ]]
        ];

        $ch_fb = curl_init('https://graph.facebook.com/v21.0/' . $pixel['id'] . '/events?access_token=' . $pixel['token']);
        curl_setopt($ch_fb, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch_fb, CURLOPT_POST, true);
        curl_setopt($ch_fb, CURLOPT_POSTFIELDS, json_encode($fb_payload));
        curl_setopt($ch_fb, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch_fb, CURLOPT_TIMEOUT, 10);
        $fb_resp = curl_exec($ch_fb);
        $fb_code = curl_getinfo($ch_fb, CURLINFO_HTTP_CODE);
        curl_close($ch_fb);

        file_put_contents($log_dir . '/cron_capi_' . $pixel['id'] . '_' . $key . '.log', json_encode([
            'pixel' => $pixel['id'], 'response_code' => $fb_code, 'response' => $fb_resp
        ], JSON_PRETTY_PRINT));
    }

    // UTMIFY
    $amount_brl = $amount * 5.8;
    $amount_cents = (int)round($amount_brl * 100);
    $now = date('c');

    $utmify_payload = [
        "orderId" => $pending['waymb_id'] ?? $key,
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
        "products" => [[
            "id" => !empty($products[0]['id']) ? $products[0]['id'] : "prod_01",
            "name" => !empty($products[0]['name']) ? $products[0]['name'] : "Worten Produto",
            "planId" => "plan_01",
            "planName" => "",
            "quantity" => 1,
            "priceInCents" => $amount_cents
        ]],
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
        'x-api-token: CUgtBZAPTKhCmfHtbtBTT3Q3yk9fRuutmHCh'
    ]);
    curl_setopt($ch_utm, CURLOPT_TIMEOUT, 10);
    $utm_resp = curl_exec($ch_utm);
    $utm_code = curl_getinfo($ch_utm, CURLINFO_HTTP_CODE);
    curl_close($ch_utm);

    file_put_contents($log_dir . '/cron_utmify_' . $key . '.log', json_encode([
        'response_code' => $utm_code, 'response' => $utm_resp
    ], JSON_PRETTY_PRINT));

    // RASTREIO WEBHOOK
    $shipping = $pending['shipping'] ?? [];

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

    $ch_r = curl_init('https://rastreio-encomendas.vercel.app/api/webhook/waylinx?token=fb01e315-c319-4c9c-86e6-603db3ac7b28');
    curl_setopt($ch_r, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch_r, CURLOPT_POST, true);
    curl_setopt($ch_r, CURLOPT_POSTFIELDS, json_encode($rastreio_payload));
    curl_setopt($ch_r, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch_r, CURLOPT_TIMEOUT, 10);
    curl_exec($ch_r);
    curl_close($ch_r);
}
