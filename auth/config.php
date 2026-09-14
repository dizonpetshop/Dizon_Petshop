<?php
session_start();
date_default_timezone_set('Asia/Manila');

// 1. Load Composer's autoloader FIRST before referencing any PHPMailer classes
$autoload = __DIR__ . '/../vendor/autoload.php';

// Fallback check if config.php is located in the root folder instead of /auth/
if (!file_exists($autoload)) {
    $autoload = __DIR__ . '/vendor/autoload.php';
}

if (!file_exists($autoload)) {
    die('Composer autoload file not found. Checked: ' . $autoload);
}

require_once $autoload;

// 2. Import PHPMailer classes
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// 3. Database configuration
const DB_HOST = '127.0.0.1';
const DB_USER = 'root';
const DB_PASS = '';
const DB_NAME = 'petshop_db';

// 4. SMTP configuration
const SMTP_HOST      = 'smtp.gmail.com';
const SMTP_USER      = 'dizonpetshop@gmail.com';       // Your actual Gmail address
const SMTP_PASS      = 'tpnk lxpk eckr baje';           // Your Google App Password
const SMTP_PORT      = 587;                              // Port 587 for STARTTLS
const SMTP_SECURE    = PHPMailer::ENCRYPTION_STARTTLS; // STARTTLS for Gmail
const SMTP_DEBUG     = 0;                              // Set to 0 in production to avoid output errors
const MAIL_FROM      = 'dizonpetshop@gmail.com';       // Must match your Gmail address
const MAIL_FROM_NAME = 'Dizon Pet Shop'; // Sender name

function connectDb(): mysqli {
    $connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

    if ($connection->connect_error) {
        die('Database connection failed: ' . $connection->connect_error);
    }

    return $connection;
}

function redirect(string $path): void {
    header('Location: ' . $path);
    exit;
}

function setFlash(string $type, string $message): void {
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function getFlash(): ?array {
    if (!empty($_SESSION['flash'])) {
        $flash = $_SESSION['flash'];
        unset($_SESSION['flash']);
        return $flash;
    }

    return null;
}

function refreshSession(): void {
    $_SESSION['last_activity'] = time();
}

function isSessionExpired(int $timeoutMinutes = 15): bool {
    if (empty($_SESSION['user_id'])) {
        return false;
    }

    $lastActivity = $_SESSION['last_activity'] ?? time();
    return (time() - $lastActivity) > ($timeoutMinutes * 60);
}

function isLoggedIn(bool $checkExpiration = true): bool {
    if (empty($_SESSION['user_id'])) {
        return false;
    }

    if ($checkExpiration && isSessionExpired()) {
        session_unset();
        session_destroy();
        return false;
    }

    return true;
}

function isPasswordStrong(string $password): bool {
    if (strlen($password) < 8) {
        return false;
    }

    if (!preg_match('/[a-z]/', $password)) {
        return false;
    }

    if (!preg_match('/[A-Z]/', $password)) {
        return false;
    }

    if (!preg_match('/\d/', $password)) {
        return false;
    }

    if (!preg_match('/[^A-Za-z0-9]/', $password)) {
        return false;
    }

    return true;
}

function getLoginErrorMessage(string $type): string {
    return match ($type) {
        'empty' => 'Please enter both email and password.',
        'locked' => 'Your account has been locked due to multiple failed login attempts.',
        default => 'Invalid email or password.',
    };
}

function generateToken(): string {
    return bin2hex(random_bytes(32));
}

function generateVerificationCode(int $length = 6): string {
    $code = '';
    for ($i = 0; $i < $length; $i++) {
        $code .= (string) random_int(0, 9);
    }
    return $code;
}

function buildUrl(string $path): string {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $baseDir = rtrim(dirname($_SERVER['PHP_SELF']), '/');
    return $scheme . '://' . $host . ($baseDir === '.' ? '' : $baseDir) . '/' . ltrim($path, '/');
}

function getLastMailError(): ?string {
    return $_SESSION['mail_error'] ?? null;
}

function sendMail(string $to, string $subject, string $message, bool $isHtml = true): bool {
    unset($_SESSION['mail_error']);

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->SMTPDebug   = SMTP_DEBUG;
        $mail->Debugoutput = function($str, $level) {
            error_log("PHPMailer debug [{$level}]: {$str}");
        };
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = SMTP_SECURE;
        $mail->Port       = SMTP_PORT;
        $mail->CharSet    = 'UTF-8';
        $mail->SMTPAutoTLS = SMTP_SECURE !== PHPMailer::ENCRYPTION_SMTPS;

        // Bypass SSL Certificate Verification on Localhost (XAMPP Fix)
        $mail->SMTPOptions = array(
            'ssl' => array(
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true
            )
        );
        
        $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
        $mail->addAddress($to);
        $mail->Subject    = $subject;
        
        if ($isHtml) {
            $mail->isHTML(true);
            $mail->Body    = $message;
            $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $message));
        } else {
            $mail->isHTML(false);
            $mail->Body    = $message;
        }

        return $mail->send();
    } catch (Exception $e) {
        $_SESSION['mail_error'] = $e->getMessage();
        error_log('Mailer Error: ' . $e->getMessage());
        return false;
    }
}
?>
