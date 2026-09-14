<?php
// Start the session so registration can be marked complete after saving the pet.
session_start();
require_once __DIR__ . '/photo_upload.php';
$servername = "Localhost";
$username = "root";
$password = "";
$dbname = "petshop_db";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Save the pet only after receiving the registration form.
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $customer_id = isset($_POST['customer_id']) ? (int) $_POST['customer_id'] : 0;

    if ($customer_id <= 0) {
        die("Customer ID is missing.");
    }

    $pet_name   = $_POST['pet_name'] ?? '';
    $species    = $_POST['species'] ?? '';
    $breed      = $_POST['breed'] ?? '';

    try {
        $photoPath = saveUploadedPhoto($_FILES['pet_photo'] ?? [], 'pet');
        ensurePhotoColumn($conn, 'pets');
    } catch (RuntimeException | InvalidArgumentException $exception) {
        die($exception->getMessage());
    }

    $sql = "INSERT INTO pets (customer_id, pet_name, breed, species, photo_path) VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);

    if ($stmt) {
        $stmt->bind_param("issss", $customer_id, $pet_name, $breed, $species, $photoPath);

        // A saved pet completes registration and unlocks the customer dashboard.
        if ($stmt->execute()) {
            $_SESSION['registration_completed'] = true;

            $stmt->close();
            $conn->close();

            header("Location: dashboard.php");
            exit();
        } else {
            echo "Error executing query: " . $stmt->error;
        }
    } else {
        echo "Error preparing statement: " . $conn->error;
    }
}
$conn->close();
?>