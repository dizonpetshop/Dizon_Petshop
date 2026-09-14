<?php
session_start();
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/customer_access.php';

if (!isset($_SESSION['user_id']) || !hasCompletedCustomerRegistration($pdo)) {
    header('Location: ../auth/login.php');
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: products.php');
    exit();
}

$name = trim($_POST['name'] ?? '');
$quantity = filter_var($_POST['quantity'] ?? 1, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 99],
]);

if ($name === '' || $quantity === false) {
    $_SESSION['cart_message'] = 'The product could not be added to your cart.';
    header('Location: products.php');
    exit();
}

// Siguraduhing totoo ang produkto sa database
try {
    $stmt = $pdo->prepare("SELECT * FROM products WHERE product_name = ?");
    $stmt->execute([$name]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        $_SESSION['cart_message'] = 'Product not found.';
        header('Location: products.php');
        exit();
    }
} catch (PDOException $e) {
    $_SESSION['cart_message'] = 'Database error.';
    header('Location: products.php');
    exit();
}

// Initialize cart kung wala pa
if (!isset($_SESSION['cart'])) {
    $_SESSION['cart'] = [];
}

// Gamitin ang mismong pangalan ng produkto bilang key para diretso at madaling basahin
if (isset($_SESSION['cart'][$name])) {
    $_SESSION['cart'][$name] += $quantity;
} else {
    $_SESSION['cart'][$name] = $quantity;
}

$_SESSION['cart_message'] = htmlspecialchars($name) . ' added to your cart.';
header('Location: products.php');
exit();
can u switch this to reservation