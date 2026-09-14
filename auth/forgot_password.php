<?php
// 1. Include config.php (handles session start, Composer autoload, PHPMailer setup, and helper functions)
require_once __DIR__ . '/config.php';

// 2. Establish PDO database connection (configured for MySQLi/PDO compatibility)
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    die('Database connection failed: ' . $e->getMessage());
}

/**
 * Sends a password reset email using PHPMailer via the sendMail() function in config.php.
 */
function sendPasswordResetCode(string $email, string $code): bool
{
    $subject = 'Password Reset Verification Code';
    $message = '
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
            <p>Hello,</p>
            <p>Your verification code is: <strong style="font-size: 1.2rem;">' . htmlspecialchars($code) . '</strong></p>
            <p>Use this code within 20 minutes to reset your password.</p>
        </body>
        </html>
    ';

    return sendMail($email, $subject, $message, true);
}

$message = '';
$error = '';
$step = 1;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['request_code'])) {
        $email = strtolower(trim($_POST['email'] ?? ''));

        if (empty($email)) {
            $error = "Please enter your registered email address.";
        } else {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if ($user) {
                // Generate a 6-digit verification code using helper from config.php
                $code = generateVerificationCode(6);
                // Set code expiration to 20 minutes
                $expires = date("Y-m-d H:i:s", strtotime("+20 minutes"));

                $update = $pdo->prepare("UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?");
                $update->execute([$code, $expires, $email]);

                $_SESSION['reset_email'] = $email;
                $step = 2;

                if (sendPasswordResetCode($email, $code)) {
                    $message = "Verification code sent to <strong>" . htmlspecialchars($email) . "</strong>. Please check your inbox.";
                } else {
                    $mailError = getLastMailError();
                    $errorDetails = $mailError ? " (" . htmlspecialchars($mailError) . ")" : "";
                    $message = "Failed to send email" . $errorDetails . ". For testing, your code is: <strong>$code</strong>";
                }
            } else {
                $error = "Email address not found in our system.";
            }
        }
    } elseif (isset($_POST['verify_and_reset'])) {
        $email = $_SESSION['reset_email'] ?? '';
        $entered_code = trim($_POST['verification_code'] ?? '');
        $new_password = $_POST['password'] ?? '';
        $confirm_password = $_POST['confirm_password'] ?? '';

        $step = 2;

        if (empty($entered_code) || empty($new_password) || empty($confirm_password)) {
            $error = "Please fill in all fields.";
        } elseif ($new_password !== $confirm_password) {
            $error = "New passwords do not match.";
        } elseif (!isPasswordStrong($new_password)) {
            // Uses the central password policy validation from config.php
            $error = "Password must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters.";
        } else {
            $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if ($user && $user['reset_token'] === $entered_code && strtotime($user['reset_expires']) > time()) {
                $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
                $clear = $pdo->prepare("UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE email = ?");
                $clear->execute([$hashed_password, $email]);

                unset($_SESSION['reset_email']);
                $step = 1;
                $message = "Password successfully updated! You can now <a href='login.php' class='fw-bold text-success'>log in</a>.";
            } else {
                $error = "Invalid or expired verification code.";
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forgot Password - Dizon's Petshop Grooming</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&family=Playfair+Display:ital,wght@0,700;0,800;1,600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../css/style.css">
</head>
<body class="recovery-bg">

<div class="auth-shell">
    <div class="auth-card">
        <div class="auth-card-header">
            <h1 class="auth-card-title">Recovery</h1>
            <p class="auth-card-subtitle">
                <?= $step == 1 ? "Enter your email to receive a code" : "Enter verification code and new password" ?>
            </p>
        </div>

        <?php if (!empty($error)): ?>
            <div class="alert alert-danger py-2 text-center" style="font-size: 0.85rem; border-radius: 15px;"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        <?php if (!empty($message)): ?>
            <?php if ($step == 2): ?>
                <div class="auth-alert-banner"><?= $message ?></div>
            <?php else: ?>
                <div class="alert alert-success py-2 text-center" style="font-size: 0.85rem; border-radius: 15px;"><?= $message ?></div>
            <?php endif; ?>
        <?php endif; ?>

        <div class="auth-card-body">
            <div class="auth-card-brand">
                <img src="../images/cutoutlogo.png" alt="Dizon's Pet Grooming">
            </div>

            <div class="auth-card-form">
                <?php if ($step == 1): ?>
                    <form action="forgot_password.php" method="POST" id="recoveryForm">
                        <div class="mb-3">
                            <label class="form-label fw-bold" style="font-size: 0.8rem;">EMAIL ADDRESS</label>
                            <input type="email" name="email" class="form-control" required>
                        </div>
                    </form>
                <?php else: ?>
                    <form action="forgot_password.php" method="POST" id="recoveryForm">
                        <div class="mb-2">
                            <label class="form-label fw-bold" style="font-size: 0.8rem;">6-DIGIT VERIFICATION CODE</label>
                            <input type="text" name="verification_code" class="form-control text-center fw-bold" maxlength="6" required placeholder="------">
                        </div>
                        <div class="mb-2">
                            <label class="form-label fw-bold" style="font-size: 0.8rem;">NEW PASSWORD</label>
                            <div class="password-field">
                                <input type="password" name="password" id="newPassword" class="form-control" required>
                                <button type="button" class="password-toggle" data-target="newPassword" aria-label="Show password">
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        <div class="mb-2">
                            <label class="form-label fw-bold" style="font-size: 0.8rem;">CONFIRM NEW PASSWORD</label>
                            <div class="password-field">
                                <input type="password" name="confirm_password" id="confirmResetPassword" class="form-control" required>
                                <button type="button" class="password-toggle" data-target="confirmResetPassword" aria-label="Show password">
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                            </div>
                        </div>
                    </form>
                <?php endif; ?>
            </div>
        </div>

        <div class="auth-card-footer">
            <?php if ($step == 1): ?>
                <a href="login.php" class="auth-footer-btn">Back to Login</a>
                <button type="submit" name="request_code" form="recoveryForm" class="auth-footer-btn auth-footer-btn--accent">Send Verification Code</button>
            <?php else: ?>
                <a href="forgot_password.php" class="auth-footer-btn">Cancel / Resend Code</a>
                <button type="submit" name="verify_and_reset" form="recoveryForm" class="auth-footer-btn auth-footer-btn--accent">Reset Password</button>
            <?php endif; ?>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script>
    document.querySelectorAll('.password-toggle').forEach(function(button) {
        button.addEventListener('click', function() {
            const target = document.getElementById(this.dataset.target);
            const icon = this.querySelector('i');

            if (!target) return;

            if (target.type === 'password') {
                target.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                this.setAttribute('aria-label', 'Hide password');
            } else {
                target.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                this.setAttribute('aria-label', 'Show password');
            }
        });
    });
</script>
</body>
</html>