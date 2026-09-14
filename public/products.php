<?php
session_start();
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/customer_access.php';

if (empty($_SESSION['user_id'])) {
    header('Location: ../auth/login.php');
    exit;
}
if (!hasCompletedCustomerRegistration($pdo)) {
    header('Location: register_customer.php');
    exit;
}

$_SESSION['product_csrf'] ??= bin2hex(random_bytes(32));
$userName = $_SESSION['customer_name'] ?? ($_SESSION['user_name'] ?? 'Customer');
$userEmail = $_SESSION['customer_email'] ?? '';

$products = $pdo->query(
    "SELECT product_id, sku, product_name, category, price, stock_quantity, description, image
     FROM products WHERE is_active = 1 ORDER BY category, product_name"
)->fetchAll(PDO::FETCH_ASSOC);

$customerStmt = $pdo->prepare('SELECT id FROM customers WHERE email = ? LIMIT 1');
$customerStmt->execute([$userEmail]);
$customerId = (int) $customerStmt->fetchColumn();
$reservationCount = 0;
if ($customerId) {
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM product_reservations WHERE customer_id = ? AND status IN ('Pending', 'Confirmed', 'Ready for Pickup')");
    $countStmt->execute([$customerId]);
    $reservationCount = (int) $countStmt->fetchColumn();
}

$message = $_SESSION['product_message'] ?? null;
unset($_SESSION['product_message']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pet Essentials - Dizon's Petshop</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css">
</head>
<body class="products-bg premium-products-page">
<script>document.body.classList.add('theme-' + (localStorage.getItem('petshopTheme') || 'dark'));</script>
<div class="top-navbar">
    <div class="d-flex align-items-center gap-2"><button id="sidebarToggle" class="sidebar-toggle-btn" aria-label="Toggle sidebar"><i class="fa-solid fa-bars"></i></button><img src="../images/cutoutlogo.png" alt="Dizon's" class="navbar-logo"><strong>Pet Essentials</strong></div>
    <div class="d-flex align-items-center gap-3"><a href="my_product_reservations.php" class="reservation-bag-link"><i class="fa-solid fa-bag-shopping"></i><span>Reservations</span><b><?= $reservationCount ?></b></a><div class="dropdown"><a href="#" class="profile-circle" data-bs-toggle="dropdown"><i class="fa-regular fa-circle-user"></i></a><ul class="dropdown-menu dropdown-menu-end p-3"><li class="text-center"><strong><?= htmlspecialchars($userName) ?></strong><small class="d-block text-muted"><?= htmlspecialchars($userEmail) ?></small></li><li><hr class="dropdown-divider"></li><li><a class="dropdown-item" href="profile.php"><i class="fa-solid fa-id-card me-2"></i>View Profile</a></li><li><a class="dropdown-item text-danger" href="../auth/logout.php"><i class="fa-solid fa-right-from-bracket me-2"></i>Logout</a></li></ul></div></div>
</div>
<?php $activePage = 'products'; include __DIR__ . '/sidebar.php'; ?>

<main class="shop-content premium-shop-content">
    <section class="catalog-hero"><div><span>Curated for everyday care</span><h1>Everything your pet needs.</h1><p>Reserve trusted food, hygiene, toys, treats, and accessories. We hold available items for pickup for 24 hours.</p></div><div class="catalog-hero-stat"><strong><?= count($products) ?></strong><span>essentials available</span></div></section>

    <?php if ($message): ?><div class="premium-notice <?= $message['type'] ?>" role="status"><?= htmlspecialchars($message['text']) ?></div><?php endif; ?>

    <div class="catalog-toolbar"><div class="catalog-filters"><button class="active" data-filter="all">All products</button><button data-filter="dog">For dogs</button><button data-filter="cat">For cats</button></div><label class="catalog-search"><i class="fa-solid fa-magnifying-glass"></i><input id="productSearch" type="search" placeholder="Search essentials"></label></div>

    <div class="products-container premium-product-grid" id="productGrid">
        <?php foreach ($products as $product):
            $petType = stripos($product['category'], 'Cat') !== false ? 'cat' : 'dog';
            $hasImage = !empty($product['image']) && is_file(__DIR__ . '/../pictures/' . $product['image']);
            $stock = (int) $product['stock_quantity'];
        ?>
            <article class="product-card premium-product-card" data-pet="<?= $petType ?>" data-search="<?= htmlspecialchars(strtolower($product['product_name'] . ' ' . $product['category'])) ?>" data-id="<?= (int) $product['product_id'] ?>" data-name="<?= htmlspecialchars($product['product_name']) ?>" data-price="<?= htmlspecialchars($product['price']) ?>" data-category="<?= htmlspecialchars($product['category']) ?>" data-description="<?= htmlspecialchars($product['description'] ?? '') ?>" data-image="<?= $hasImage ? htmlspecialchars($product['image']) : '' ?>" data-stock="<?= $stock ?>">
                <div class="product-image-wrap product-zoom-trigger" role="button" tabindex="0">
                    <?php if ($hasImage): ?><img src="../pictures/<?= rawurlencode($product['image']) ?>" alt="<?= htmlspecialchars($product['product_name']) ?>"><?php else: ?><span class="product-placeholder <?= $petType ?>"><i class="fa-solid <?= $petType === 'cat' ? 'fa-cat' : 'fa-dog' ?>"></i></span><?php endif; ?>
                    <span class="product-category-pill"><?= htmlspecialchars($product['category']) ?></span>
                </div>
                <div class="product-details"><small><?= htmlspecialchars($product['sku']) ?></small><h2><?= htmlspecialchars($product['product_name']) ?></h2><p><?= htmlspecialchars($product['description'] ?? '') ?></p><div class="product-stock <?= $stock <= 5 ? 'low' : '' ?>"><i class="fa-solid fa-box"></i><?= $stock > 0 ? $stock . ' available' : 'Out of stock' ?></div><div class="product-purchase-row"><strong>PHP <?= number_format((float) $product['price'], 2) ?></strong><form action="reserve_product.php" method="POST"><input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['product_csrf']) ?>"><input type="hidden" name="product_id" value="<?= (int) $product['product_id'] ?>"><input type="hidden" name="quantity" value="1"><button type="submit" class="reserve-product-button" <?= $stock < 1 ? 'disabled' : '' ?>><i class="fa-solid fa-bookmark"></i><?= $stock > 0 ? 'Reserve' : 'Unavailable' ?></button></form></div></div>
            </article>
        <?php endforeach; ?>
    </div>
    <section class="catalog-empty" id="catalogEmpty" hidden><i class="fa-solid fa-paw"></i><h2>No matching products</h2><p>Try another search or category.</p></section>
</main>

<div class="modal fade product-modal" id="productModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content product-modal-content"><div class="product-modal-image" id="modalVisual"></div><div class="product-modal-info"><span class="product-modal-category" id="modalProductCategory"></span><h3 id="modalProductName" class="product-modal-name"></h3><p id="modalProductDescription" class="product-modal-description"></p><p class="product-modal-stock" id="modalProductStock"></p><p class="product-modal-price" id="modalProductPrice"></p><form action="reserve_product.php" method="POST" class="product-modal-form"><input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['product_csrf']) ?>"><input type="hidden" name="product_id" id="modalProductId"><label>Quantity<input type="number" name="quantity" id="modalQuantity" value="1" min="1" max="20"></label><button type="submit" class="reserve-product-button" id="modalReserveButton"><i class="fa-solid fa-bookmark"></i>Reserve for Pickup</button></form><button type="button" class="product-modal-close" data-bs-dismiss="modal">Continue browsing</button></div></div></div></div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script>
document.getElementById('sidebarToggle').addEventListener('click',()=>{document.querySelector('.sidebar').classList.toggle('collapsed');document.body.classList.toggle('sidebar-collapsed');});
const cards=[...document.querySelectorAll('.premium-product-card')], search=document.getElementById('productSearch'), empty=document.getElementById('catalogEmpty'); let filter='all';
function filterProducts(){let shown=0, term=search.value.trim().toLowerCase();cards.forEach(card=>{let visible=(filter==='all'||card.dataset.pet===filter)&&card.dataset.search.includes(term);card.hidden=!visible;if(visible)shown++;});empty.hidden=shown>0;}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(item=>item.classList.remove('active'));button.classList.add('active');filter=button.dataset.filter;filterProducts();}));search.addEventListener('input',filterProducts);
const modal=new bootstrap.Modal(document.getElementById('productModal'));
cards.forEach(card=>{const trigger=card.querySelector('.product-zoom-trigger');function openProduct(){const d=card.dataset,stock=parseInt(d.stock,10)||0,visual=document.getElementById('modalVisual');visual.innerHTML=d.image?'<img src="../pictures/'+encodeURIComponent(d.image)+'" alt="">':'<span class="product-placeholder '+d.pet+'"><i class="fa-solid fa-'+(d.pet==='cat'?'cat':'dog')+'"></i></span>';document.getElementById('modalProductCategory').textContent=d.category;document.getElementById('modalProductName').textContent=d.name;document.getElementById('modalProductDescription').textContent=d.description;document.getElementById('modalProductPrice').textContent='PHP '+Number(d.price).toFixed(2);document.getElementById('modalProductStock').textContent=stock+' available';document.getElementById('modalProductId').value=d.id;document.getElementById('modalQuantity').max=Math.min(stock,20);document.getElementById('modalReserveButton').disabled=stock<1;modal.show();}trigger.addEventListener('click',openProduct);trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProduct();}});});
</script>
</body></html>
