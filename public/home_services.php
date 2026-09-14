<?php
// Start session and connect to db
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/db.php';

// Handle form submission kung pinindot ang submit/book button
$success_message = "";
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $shop_name    = $_POST['shop_name'] ?? '';
    $shop_address = $_POST['shop_address'] ?? '';
    $shop_contact = $_POST['shop_contact'] ?? '';
    
    // Pwede mong i-save dito sa database o session ang tinype ng user
    $_SESSION['home_service_name']    = $shop_name;
    $_SESSION['home_service_address'] = $shop_address;
    $_SESSION['home_service_contact'] = $shop_contact;
    
    $success_message = "Home service details successfully submitted!";
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Home Services - Dizon's Petshop Grooming</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css">
</head>
<body class="app-bg">

<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card shadow-sm border-0 rounded-4 p-4">
                
                <!-- Shop Header -->
                <div class="text-center mb-4">
                    <img src="../images/cutoutlogo.png" alt="Logo" class="mb-3" style="max-height: 80px;">
                    <h2 class="fw-bold text-success">Home Services Request</h2>
                </div>

                <?php if (!empty($success_message)): ?>
                    <div class="alert alert-success alert-dismissible fade show" role="alert">
                        <i class="fa-solid fa-circle-check me-2"></i> <?php echo $success_message; ?>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>
                <?php endif; ?>

                <hr class="mb-4">

                <!-- Blank Form for User Typing -->
                <form action="home_services.php" method="POST">
                    <div class="row g-3">
                        
                        <!-- Establishment / Owner Name Input -->
                        <div class="col-md-12">
                            <div class="p-3 bg-light rounded-3">
                                <label for="shop_name" class="form-label fw-bold text-muted small mb-1">
                                    <i class="fa-solid fa-store text-success me-1"></i> Full Name
                                </label>
                                <input type="text" class="form-control fw-bold text-dark border-0 bg-white shadow-sm" id="shop_name" name="shop_name" placeholder="" required>
                            </div>
                        </div>

                        <!-- Address Input -->
                        <div class="col-md-12">
                            <div class="p-3 bg-light rounded-3">
                                <label for="shop_address" class="form-label fw-bold text-muted small mb-1">
                                    <i class="fa-solid fa-location-dot text-danger me-1"></i> Complete Address
                                </label>
                                <input type="text" class="form-control fw-bold text-dark border-0 bg-white shadow-sm" id="shop_address" name="shop_address" placeholder="" required>
                            </div>
                        </div>

                        <!-- Contact Number Input -->
                        <div class="col-md-12">
                            <div class="p-3 bg-light rounded-3">
                                <label for="shop_contact" class="form-label fw-bold text-muted small mb-1">
                                    <i class="fa-solid fa-phone-volume text-primary me-1"></i> Contact Number
                                </label>
                                <input type="text" class="form-control fw-bold text-dark border-0 bg-white shadow-sm" id="shop_contact" name="shop_contact" placeholder="" required>
                            </div>
                        </div>

                    </div>

                    <!-- Action Buttons -->
                    <div class="mt-4 d-flex justify-content-between align-items-center">
                        <a href="grooming.php" class="btn btn-outline-secondary px-4 py-2 rounded-pill fw-bold">
                            <i class="fa-solid fa-arrow-left me-2"></i> Back
                        </a>
                        <button type="submit" class="btn btn-success px-4 py-2 rounded-pill fw-bold shadow-sm">
                            <i class="fa-solid fa-check me-2"></i> Submit Details
                        </button>
                    </div>
                </form>

            </div>
        </div>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>