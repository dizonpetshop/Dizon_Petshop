<?php
date_default_timezone_set('Asia/Manila');

$host = '127.0.0.1';
$db   = 'petshop_db';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET time_zone = '+08:00'");
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

/**
 * Function para awtomatikong mag-save ng user activity log sa database.
 * 
 * @param PDO    $pdo      Ang database connection object
 * @param string $page_name Ang pangalan o title ng pahinang binisita
 */
function logUserActivity($pdo, $page_name) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    if (isset($_SESSION['user_id'])) {
        try {
            $stmt = $pdo->prepare("INSERT INTO user_activity_logs (user_id, page_name, visited_at) VALUES (?, ?, NOW())");
            $stmt->execute([$_SESSION['user_id'], $page_name]);
        } catch (PDOException $e) {
            // Ipakita ang error kung sakaling may mali sa table column o database
            echo "Activity Log Error: " . $e->getMessage();
            exit();
        }
    }
}
?>
