<?php
require_once __DIR__ . '/../config/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
}

requireLogin();

$data = json_decode(file_get_contents('php://input'), true);
$deviceId = $data['device_id'] ?? '';

if (empty($deviceId)) {
    jsonResponse(['success' => false, 'message' => 'Device ID required']);
}

if (!isGenieACSConfigured()) {
    jsonResponse(['success' => false, 'message' => 'GenieACS is not yet configured']);
}

$conn = getDBConnection();
$result = $conn->query("SELECT * FROM genieacs_credentials WHERE is_connected = 1 ORDER BY id DESC LIMIT 1");
$credentials = $result->fetch_assoc();

if (!$credentials) {
    jsonResponse(['success' => false, 'message' => 'GenieACS is not connected']);
}

use App\GenieACS;

$genieacs = new GenieACS(
    $credentials['host'],
    $credentials['port'],
    $credentials['username'],
    $credentials['password']
);

// Use the new method that summons device AND fetches admin credentials
$result = $genieacs->summonAndFetchAdminCredentials($deviceId);

if ($result['success']) {
    jsonResponse(['success' => true, 'message' => 'Device summon successful and admin credentials are being retrieved...']);
} else {
    $errorMsg = 'Failed to summon device';
    if (isset($result['error'])) {
        $errorMsg .= ': ' . $result['error'];
    } elseif (isset($result['http_code'])) {
        $errorMsg .= ' (HTTP ' . $result['http_code'] . ')';
    }
    jsonResponse(['success' => false, 'message' => $errorMsg]);
}
