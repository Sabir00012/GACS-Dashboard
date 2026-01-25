<?php
/**
 * API endpoint for clearing client-side logs
 * Only accessible by logged-in users
 */

require_once __DIR__ . '/../config/config.php';
requireLogin();

header('Content-Type: application/json');

// Log file paths (try both)
$logFiles = [
    '/var/log/gacs-client.log',
    __DIR__ . '/../logs/client.log'
];

$cleared = false;
$clearedFiles = [];

foreach ($logFiles as $file) {
    if (file_exists($file)) {
        if (@file_put_contents($file, '') !== false) {
            $cleared = true;
            $clearedFiles[] = $file;
        }
    }
}

if ($cleared) {
    echo json_encode([
        'success' => true,
        'message' => 'Logs cleared successfully',
        'clearedFiles' => $clearedFiles
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'No log files found or failed to clear'
    ]);
}
