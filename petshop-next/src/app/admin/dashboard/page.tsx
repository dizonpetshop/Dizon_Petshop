import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminIcon from "@/components/AdminIcon";
import AdminProductCard from "@/components/AdminProductCard";
import AdminShell from "@/components/AdminShell";
import AdminSubmitButton from "@/components/AdminSubmitButton";
import { prisma } from "@/lib/prisma";
import { productImageSrc } from "@/lib/product-image";
import { readSessionToken, sessionCookieName } from "@/lib/session";
import { createProduct, updateAddon, updateClientStatus, updateGroomingStatus, updatePackage, updateProductReservationStatus } from "../actions";

const money = (value: { toString(): string }) => Number(value.toString()).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value: Date) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "2-digit", year: "numeric", timeZone: "Asia/Manila" }).format(value);
const time = (value: Date) => new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(value);
const dayKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila" }).format(value);
const views = ["dashboard", "products", "categories", "inventory", "orders", "reservations", "customers", "services", "schedules", "reports", "admins", "settings", "profile"] as const;
type AdminView = (typeof views)[number];

const viewCopy: Record<AdminView, { title: string; description: string }> = {
  dashboard: { title: "Dashboard", description: "Your daily operations at a glance." }, products: { title: "Products", description: "Manage product details, pricing, images, and visibility." },
  categories: { title: "Categories", description: "Review how products are organized across the catalog." }, inventory: { title: "Inventory", description: "Monitor quantities and act on low-stock items." },
  orders: { title: "Orders", description: "Track and update product pickup reservations." }, reservations: { title: "Reservations", description: "Manage grooming appointments and customer bookings." },
  customers: { title: "Customers", description: "Review client accounts and control access." }, services: { title: "Grooming Services", description: "Maintain grooming packages and add-on pricing." },
  schedules: { title: "Schedules", description: "See upcoming grooming work in chronological order." }, reports: { title: "Business Reports", description: "Understand product demand and appointment activity." },
  admins: { title: "Admin Management", description: "Manage elevated access through the protected Super Admin area." }, settings: { title: "Settings", description: "Review system and account configuration." },
  profile: { title: "My Profile", description: "View the account currently signed in to the admin portal." },
};

function valueOf(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (["active", "completed", "claimed", "confirmed", "ready for pickup"].includes(normalized)) return "success";
  if (["cancelled", "suspended"].includes(normalized)) return "danger";
  if (["pending"].includes(normalized)) return "warning";
  return "info";
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const requestedView = valueOf(query.view);
  const activeView: AdminView = views.includes(requestedView as AdminView) ? requestedView as AdminView : "dashboard";
  const search = valueOf(query.q).trim().toLowerCase();
  const filter = valueOf(query.filter).trim();
  const notice = valueOf(query.notice);
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session?.role !== "Admin" && session?.role !== "SuperAdmin") redirect("/admin/login");
  const currentAdmin = await prisma.user.findFirst({ where: { id: session.userId, role: { in: ["Admin", "SuperAdmin"] }, accountStatus: "Active" }, select: { id: true, firstName: true, surname: true, username: true, email: true, phoneNumber: true, role: true, accountStatus: true, createdAt: true } });
  if (!currentAdmin) redirect("/admin/login");

  const [clients, products, packages, addons, appointments, productReservations] = await Promise.all([
    prisma.user.findMany({ where: { role: "User" }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ orderBy: [{ isActive: "desc" }, { category: "asc" }, { productName: "asc" }] }),
    prisma.styleSizePricing.findMany({ include: { style: true }, orderBy: [{ styleId: "asc" }, { pricingId: "asc" }] }),
    prisma.groomingAddon.findMany({ orderBy: { addonName: "asc" } }),
    prisma.groomingAppointment.findMany({ include: { customer: true, pet: true, style: true, groomer: true }, orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }], take: 100 }),
    prisma.productReservation.findMany({ include: { customer: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const adminName = [currentAdmin.firstName, currentAdmin.surname].filter(Boolean).join(" ") || session.name || "Administrator";
  const today = new Date();
  const todayKey = dayKey(today);
  const activeProducts = products.filter((item) => item.isActive);
  const lowStockProducts = activeProducts.filter((item) => item.stockQuantity <= item.reorderLevel);
  const pendingOrders = productReservations.filter((item) => ["Pending", "Confirmed", "Ready for Pickup"].includes(item.status));
  const todayAppointments = appointments.filter((item) => dayKey(item.appointmentDate) === todayKey && item.status !== "Cancelled");
  const pendingAppointments = appointments.filter((item) => ["Pending", "Confirmed"].includes(item.status));
  const completedSales = productReservations.filter((item) => item.status === "Claimed").reduce((sum, item) => sum + Number(item.totalAmount.toString()), 0);
  const notifications = lowStockProducts.length + pendingOrders.filter((item) => item.status === "Pending").length + appointments.filter((item) => item.status === "Pending").length;
  const categoryRows = [...new Set(products.map((item) => item.category))].sort().map((category) => ({ category, products: products.filter((item) => item.category === category) }));
  const visibleProducts = products.filter((item) => (!search || `${item.productName} ${item.sku || ""} ${item.category}`.toLowerCase().includes(search)) && (!filter || filter === "All" || (filter === "Active" ? item.isActive : filter === "Inactive" ? !item.isActive : item.category === filter)));
  const visibleClients = clients.filter((item) => (!search || `${item.firstName || ""} ${item.surname || ""} ${item.email}`.toLowerCase().includes(search)) && (!filter || filter === "All" || item.accountStatus === filter));
  const visibleOrders = productReservations.filter((item) => (!search || `${item.reservationCode} ${item.customer.customerName} ${item.items.map((line) => line.product.productName).join(" ")}`.toLowerCase().includes(search)) && (!filter || filter === "All" || item.status === filter));
  const visibleAppointments = appointments.filter((item) => (!search || `${item.reservationCode} ${item.customer.customerName} ${item.pet.petName} ${item.style.styleName}`.toLowerCase().includes(search)) && (!filter || filter === "All" || item.status === filter));
  const requestedPage = Math.max(1, Number.parseInt(valueOf(query.page), 10) || 1);
  const pageSize = activeView === "products" ? 9 : 15;
  const activeListLength = activeView === "products" ? visibleProducts.length : activeView === "customers" ? visibleClients.length : activeView === "orders" ? visibleOrders.length : visibleAppointments.length;
  const totalPages = Math.max(1, Math.ceil(activeListLength / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedProducts = visibleProducts.slice(pageStart, pageStart + pageSize);
  const pagedClients = visibleClients.slice(pageStart, pageStart + pageSize);
  const pagedOrders = visibleOrders.slice(pageStart, pageStart + pageSize);
  const pagedAppointments = visibleAppointments.slice(pageStart, pageStart + pageSize);
  const productSales = new Map<string, number>();
  for (const reservation of productReservations.filter((item) => item.status !== "Cancelled")) for (const item of reservation.items) productSales.set(item.product.productName, (productSales.get(item.product.productName) || 0) + item.quantity);
  const topProducts = [...productSales].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const appointmentStats = ["Pending", "Confirmed", "Completed", "Cancelled"].map((status) => [status, appointments.filter((item) => item.status === status).length] as const);
  const groomerStats = [...new Set(appointments.map((item) => item.groomer.groomerName))].map((name) => [name, appointments.filter((item) => item.groomer.groomerName === name).length] as const);
  const maxProductSales = Math.max(1, ...topProducts.map(([, count]) => count));
  const maxAppointments = Math.max(1, ...appointmentStats.map(([, count]) => count), ...groomerStats.map(([, count]) => count));

  return <AdminShell activeView={activeView} adminName={adminName} adminRole={currentAdmin.role === "SuperAdmin" ? "Super Administrator" : "Administrator"} notificationCount={notifications} pageDescription={viewCopy[activeView].description} pageTitle={viewCopy[activeView].title}>
    <div className="adminBreadcrumbs"><Link href="/admin/dashboard?view=dashboard">Dashboard</Link>{activeView !== "dashboard" && <><span>/</span><b>{viewCopy[activeView].title}</b></>}</div>
    {notice && <div className="adminToast success" role="status"><span>✓</span>{notice}</div>}
    {activeView === "dashboard" && <>
      <section className="adminWelcome"><div><p className="adminEyebrow">{new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(today)}</p><h2>Welcome back, {currentAdmin.firstName || "Admin"}.</h2><p>Here is what needs your attention across the shop today.</p></div><Link className="adminPrimaryButton" href="/admin/dashboard?view=products#add-product">+ Add Product</Link></section>
      {(notifications > 0) && <section className="adminAttention" id="attention"><AdminIcon name="warning"/><div><b>{notifications} item{notifications === 1 ? "" : "s"} need attention</b><p>{lowStockProducts.length} low stock, {pendingOrders.filter((item) => item.status === "Pending").length} pending orders, and {appointments.filter((item) => item.status === "Pending").length} pending appointments.</p></div><Link href="/admin/dashboard?view=inventory&filter=Low">Review now</Link></section>}
      <section className="adminMetricGrid">
        <Metric icon="products" label="Total Products" value={products.length} detail={`${activeProducts.length} currently visible`} />
        <Metric icon="customers" label="Total Customers" value={clients.length} detail={`${clients.filter((item) => item.accountStatus === "Active").length} active accounts`} />
        <Metric icon="orders" label="Pending Orders" value={pendingOrders.length} detail="Awaiting completion" tone="amber" />
        <Metric icon="calendar" label="Reservations Today" value={todayAppointments.length} detail={`${pendingAppointments.length} active bookings`} />
        <Metric icon="warning" label="Low Stock Items" value={lowStockProducts.length} detail="At or below alert level" tone="red" />
        <Metric icon="sales" label="Completed Sales" value={`₱${completedSales.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} detail="Claimed product orders" tone="green" />
      </section>
      <div className="adminDashboardGrid">
        <section className="adminPanel"><SectionHeading eyebrow="LATEST ACTIVITY" title="Recent Orders" action={<Link href="/admin/dashboard?view=orders">View all</Link>} />{productReservations.length ? <div className="adminTableScroll"><table className="modernAdminTable"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{productReservations.slice(0, 5).map((item) => <tr key={item.reservationId.toString()}><td><b>{item.reservationCode}</b></td><td>{item.customer.customerName}</td><td>{date(item.createdAt)}</td><td>₱{money(item.totalAmount)}</td><td><StatusBadge status={item.status}/></td></tr>)}</tbody></table></div> : <EmptyState title="No orders yet" text="Product reservations will appear here." />}</section>
        <section className="adminPanel"><SectionHeading eyebrow="SHORTCUTS" title="Quick Actions"/><div className="adminQuickActions"><Link href="/admin/dashboard?view=products#add-product"><AdminIcon name="products"/>Add Product</Link><Link href="/admin/dashboard?view=categories"><AdminIcon name="categories"/>View Categories</Link><Link href="/admin/dashboard?view=reservations"><AdminIcon name="calendar"/>Reservations</Link><Link href="/admin/dashboard?view=orders"><AdminIcon name="orders"/>View Orders</Link><Link href="/admin/dashboard?view=customers"><AdminIcon name="customers"/>View Customers</Link></div></section>
      </div>
      <div className="adminDashboardGrid lower">
        <section className="adminPanel"><SectionHeading eyebrow="TODAY" title="Upcoming Appointments" action={<Link href="/admin/dashboard?view=schedules">Full schedule</Link>} />{todayAppointments.length ? <div className="adminTableScroll"><table className="modernAdminTable"><thead><tr><th>Customer</th><th>Service</th><th>Time</th><th>Status</th></tr></thead><tbody>{todayAppointments.slice(0, 6).map((item) => <tr key={item.appointmentId.toString()}><td><b>{item.customer.customerName}</b><small>{item.pet.petName}</small></td><td>{item.style.styleName}</td><td>{time(item.appointmentTime)}</td><td><StatusBadge status={item.status}/></td></tr>)}</tbody></table></div> : <EmptyState title="No appointments today" text="Today's confirmed and pending bookings will appear here." />}</section>
        <section className="adminPanel"><SectionHeading eyebrow="INVENTORY ALERT" title="Low Stock Products" action={<Link href="/admin/dashboard?view=inventory">View inventory</Link>} />{lowStockProducts.length ? <div className="adminCompactList">{lowStockProducts.slice(0, 6).map((item) => <Link href={`/admin/dashboard?view=products&q=${encodeURIComponent(item.productName)}`} key={item.productId}><span><b>{item.productName}</b><small>{item.category}</small></span><StatusBadge status={`${item.stockQuantity} left`} tone="warning"/></Link>)}</div> : <EmptyState title="Stock levels look good" text="No active products are below their alert level." />}</section>
      </div>
    </>}

    {activeView === "products" && <section className="adminModule"><SectionHeading eyebrow="CATALOG MANAGEMENT" title="All Products" detail={`${visibleProducts.length} of ${products.length} products`} />
      <FilterBar filter={filter} options={["All", "Active", "Inactive", ...categoryRows.map((item) => item.category)]} placeholder="Search products, SKU, or category..." search={valueOf(query.q)} view="products" />
      <details className="modernCreatePanel" id="add-product"><summary><span>+</span>Add a new product</summary><form action={createProduct} className="modernAdminForm"><label>SKU <span>*</span><input name="sku" required /></label><label>Product name <span>*</span><input name="name" required /></label><label>Category <span>*</span><input name="category" required /></label><label>Product group <span>*</span><select name="group"><option>Food</option><option>Shampoo</option><option>Other</option></select></label><label>Price <span>*</span><input name="price" type="number" min="0" step="0.01" required /></label><label>Quantity <span>*</span><input name="stock" type="number" min="0" required /></label><label>Low-stock alert <span>*</span><input name="reorder" type="number" min="0" defaultValue="5" required /></label><label className="spanTwo">Description<input name="description" /></label><label className="spanTwo">Product image <small>JPG, PNG, or WebP. Maximum 1.5 MB.</small><input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" /></label><div className="modernFormActions"><AdminSubmitButton pendingText="Adding product...">Add Product</AdminSubmitButton></div></form></details>
      {visibleProducts.length ? <><div className="databaseCardGrid modernProductGrid">{pagedProducts.map((product) => <AdminProductCard key={product.productId} id={product.productId} sku={product.sku || `PRODUCT-${product.productId}`} name={product.productName} category={product.category} description={product.description || ""} group={product.productGroup} price={money(product.price)} stock={product.stockQuantity} reorder={product.reorderLevel} active={product.isActive} imageSrc={productImageSrc(product.image, product.productName, product.category, product.productId)} />)}</div><Pagination filter={filter} page={currentPage} pages={totalPages} search={valueOf(query.q)} view="products"/></> : <EmptyState action="Add Product" href="/admin/dashboard?view=products#add-product" title="No products found" text="Try a different search or add a new product." />}
    </section>}

    {activeView === "categories" && <section className="adminModule"><SectionHeading eyebrow="CATALOG STRUCTURE" title="Product Categories" detail={`${categoryRows.length} categories`} /><div className="adminCategoryGrid">{categoryRows.map((item) => <Link href={`/admin/dashboard?view=products&filter=${encodeURIComponent(item.category)}`} key={item.category}><span className="categoryIcon"><AdminIcon name="categories"/></span><b>{item.category}</b><p>{item.products.length} product{item.products.length === 1 ? "" : "s"}</p><small>{item.products.filter((product) => product.isActive).length} active · {item.products.reduce((sum, product) => sum + product.stockQuantity, 0)} units</small></Link>)}</div>{!categoryRows.length && <EmptyState action="Add Product" href="/admin/dashboard?view=products#add-product" title="No categories yet" text="Categories are created from the category field on products." />}</section>}

    {activeView === "inventory" && <section className="adminModule"><SectionHeading eyebrow="STOCK CONTROL" title="Inventory Overview" detail={`${lowStockProducts.length} low-stock items`} /><div className="adminMetricGrid compact"><Metric icon="package" label="Total Units" value={products.reduce((sum, item) => sum + item.stockQuantity, 0)} detail="Across all products"/><Metric icon="products" label="Active Products" value={activeProducts.length} detail="Visible to customers"/><Metric icon="warning" label="Low Stock" value={lowStockProducts.length} detail="Needs attention" tone="red"/></div><div className="adminTableCard"><div className="adminTableScroll"><table className="modernAdminTable"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Stock</th><th>Alert level</th><th>Status</th><th>Action</th></tr></thead><tbody>{products.map((item) => <tr key={item.productId}><td><b>{item.productName}</b></td><td>{item.sku || "—"}</td><td>{item.category}</td><td>{item.stockQuantity}</td><td>{item.reorderLevel}</td><td><StatusBadge status={item.stockQuantity <= item.reorderLevel ? "Low stock" : "In stock"} tone={item.stockQuantity <= item.reorderLevel ? "warning" : "success"}/></td><td><Link className="adminTableAction" href={`/admin/dashboard?view=products&q=${encodeURIComponent(item.productName)}`}>Update</Link></td></tr>)}</tbody></table></div></div></section>}

    {activeView === "customers" && <section className="adminModule"><SectionHeading eyebrow="CUSTOMER MANAGEMENT" title="Customer Accounts" detail={`${visibleClients.length} of ${clients.length} customers`} /><FilterBar filter={filter} options={["All", "Active", "Suspended"]} placeholder="Search customer name or email..." search={valueOf(query.q)} view="customers"/><div className="adminTableCard"><div className="adminTableScroll"><table className="modernAdminTable"><thead><tr><th>Customer</th><th>Contact</th><th>Joined</th><th>Status</th><th>Account access</th></tr></thead><tbody>{pagedClients.map((client) => <tr key={client.id}><td><b>{[client.firstName, client.surname].filter(Boolean).join(" ") || "Customer"}</b><small>{client.email}</small></td><td>{client.phoneNumber || "Not provided"}</td><td>{date(client.createdAt)}</td><td><StatusBadge status={client.accountStatus}/></td><td><form action={updateClientStatus} className="adminInlineForm"><input type="hidden" name="id" value={client.id}/><select aria-label={`Access status for ${client.email}`} name="status" defaultValue={client.accountStatus}><option>Active</option><option>Suspended</option></select><AdminSubmitButton>Update</AdminSubmitButton></form></td></tr>)}</tbody></table></div>{!visibleClients.length && <EmptyState title="No customers found" text="Try changing the search or status filter." />}<Pagination filter={filter} page={currentPage} pages={totalPages} search={valueOf(query.q)} view="customers"/></div></section>}

    {activeView === "orders" && <section className="adminModule"><SectionHeading eyebrow="ORDER MANAGEMENT" title="Product Pickup Orders" detail={`${visibleOrders.length} records`} /><FilterBar filter={filter} options={["All", "Pending", "Confirmed", "Ready for Pickup", "Claimed", "Cancelled"]} placeholder="Search order, customer, or product..." search={valueOf(query.q)} view="orders"/><div className="adminTableCard"><div className="adminTableScroll"><table className="modernAdminTable"><thead><tr><th>Order ID</th><th>Customer / Items</th><th>Date</th><th>Amount</th><th>Status & Action</th></tr></thead><tbody>{pagedOrders.map((item) => <tr key={item.reservationId.toString()}><td><b>{item.reservationCode}</b></td><td><b>{item.customer.customerName}</b><small>{item.items.map((line) => `${line.product.productName} × ${line.quantity}`).join(", ")}</small></td><td>{date(item.createdAt)}</td><td>₱{money(item.totalAmount)}</td><td>{item.status === "Cancelled" ? <StatusBadge status={item.status}/> : <form action={updateProductReservationStatus} className="adminInlineForm"><input type="hidden" name="id" value={item.reservationId.toString()}/><select aria-label={`Status for ${item.reservationCode}`} name="status" defaultValue={item.status}><option>Pending</option><option>Confirmed</option><option>Ready for Pickup</option><option>Claimed</option><option>Cancelled</option></select><AdminSubmitButton>Save</AdminSubmitButton></form>}</td></tr>)}</tbody></table></div>{!visibleOrders.length && <EmptyState title="No orders found" text="Product pickup reservations will appear here." />}<Pagination filter={filter} page={currentPage} pages={totalPages} search={valueOf(query.q)} view="orders"/></div></section>}

    {(activeView === "reservations" || activeView === "schedules") && <section className="adminModule"><SectionHeading eyebrow={activeView === "schedules" ? "TEAM CALENDAR" : "APPOINTMENT MANAGEMENT"} title={activeView === "schedules" ? "Grooming Schedule" : "Grooming Reservations"} detail={`${visibleAppointments.length} appointments`} /><FilterBar filter={filter} options={["All", "Pending", "Confirmed", "Completed", "Cancelled"]} placeholder="Search reference, customer, pet, or service..." search={valueOf(query.q)} view={activeView}/><div className="adminTableCard"><div className="adminTableScroll"><table className="modernAdminTable"><thead><tr><th>Reference</th><th>Customer / Pet</th><th>Service</th><th>Schedule</th><th>Groomer</th><th>Status & Action</th></tr></thead><tbody>{pagedAppointments.map((item) => <tr key={item.appointmentId.toString()}><td><b>{item.reservationCode}</b><small>{item.bookingType}</small></td><td><b>{item.customer.customerName}</b><small>{item.pet.petName}</small></td><td>{item.style.styleName}</td><td><b>{date(item.appointmentDate)}</b><small>{time(item.appointmentTime)}</small></td><td>{item.groomer.groomerName}</td><td><form action={updateGroomingStatus} className="adminInlineForm"><input type="hidden" name="id" value={item.appointmentId.toString()}/><select aria-label={`Status for ${item.reservationCode}`} name="status" defaultValue={item.status}><option>Pending</option><option>Confirmed</option><option>Completed</option><option>Cancelled</option></select><AdminSubmitButton>Save</AdminSubmitButton></form></td></tr>)}</tbody></table></div>{!visibleAppointments.length && <EmptyState title="No reservations found" text="Try changing the search or status filter." />}<Pagination filter={filter} page={currentPage} pages={totalPages} search={valueOf(query.q)} view={activeView}/></div></section>}

    {activeView === "services" && <section className="adminModule"><SectionHeading eyebrow="SERVICE CATALOG" title="Packages and Add-ons" detail={`${packages.length + addons.length} price records`} /><div className="modernManagementColumns"><section className="adminTableCard"><SectionHeading eyebrow="SIZE-BASED" title="Grooming Packages"/><div className="adminTableScroll"><table className="modernAdminTable"><thead><tr><th>Package</th><th>Pet size</th><th>Price</th><th>Action</th></tr></thead><tbody>{packages.map((item) => <tr key={item.pricingId}><td colSpan={4}><form action={updatePackage} className="serviceEditRow"><input type="hidden" name="id" value={item.pricingId}/><label><span>Package</span><input name="name" defaultValue={item.style.styleName}/></label><label><span>Pet size</span><input value={item.petSize} disabled readOnly/></label><label><span>Price</span><input type="number" name="price" step="0.01" min="0" defaultValue={money(item.price)}/></label><AdminSubmitButton>Save</AdminSubmitButton></form></td></tr>)}</tbody></table></div></section><section className="adminTableCard"><SectionHeading eyebrow="OPTIONAL CARE" title="Add-on Services"/><div className="adminAddonList">{addons.map((item) => <form action={updateAddon} className="serviceEditRow addon" key={item.addonId}><input type="hidden" name="id" value={item.addonId}/><label><span>Service name</span><input name="name" defaultValue={item.addonName}/></label><label><span>Price</span><input type="number" name="price" step="0.01" min="0" defaultValue={money(item.price)}/></label><AdminSubmitButton>Save</AdminSubmitButton></form>)}</div></section></div></section>}

    {activeView === "reports" && <section className="adminModule"><SectionHeading eyebrow="DATABASE INSIGHTS" title="Performance Reports" detail="Latest 100 transactions"/><div className="adminMetricGrid compact"><Metric icon="sales" label="Completed Sales" value={`₱${completedSales.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} detail="Claimed product orders" tone="green"/><Metric icon="orders" label="Total Orders" value={productReservations.length} detail="All pickup reservations"/><Metric icon="calendar" label="Appointments" value={appointments.length} detail="Latest records"/></div><div className="reportGrid modernReports"><ReportChart title="Top-selling products" rows={topProducts} maximum={maxProductSales} empty="No product sales yet."/><ReportChart title="Appointment transactions" rows={appointmentStats} maximum={maxAppointments}/><ReportChart title="Groomer workload" rows={groomerStats} maximum={maxAppointments} empty="No groomer activity yet."/></div></section>}

    {activeView === "admins" && <section className="adminModule"><SectionHeading eyebrow="ACCESS CONTROL" title="Administrator Management"/><div className="adminInfoCard"><span className="adminInfoIcon"><AdminIcon name="admins" size={28}/></span><div><h3>Protected account management</h3><p>Administrator roles and account access are managed separately to protect sensitive identity controls.</p>{currentAdmin.role === "SuperAdmin" ? <Link className="adminPrimaryButton" href="/superadmin/dashboard">Open Super Admin Center</Link> : <p className="adminPermissionNote">Only a Super Administrator can create or manage administrator accounts.</p>}</div></div></section>}

    {(activeView === "profile" || activeView === "settings") && <section className="adminModule"><SectionHeading eyebrow={activeView === "profile" ? "ACCOUNT" : "SYSTEM"} title={activeView === "profile" ? "Profile Information" : "Admin Settings"}/><div className="adminProfileCard"><div className="adminProfileHero"><span>{adminName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span><div><h3>{adminName}</h3><p>{currentAdmin.role === "SuperAdmin" ? "Super Administrator" : "Administrator"}</p></div><StatusBadge status={currentAdmin.accountStatus}/></div><dl><div><dt>Full name</dt><dd>{adminName}</dd></div><div><dt>Email address</dt><dd>{currentAdmin.email}</dd></div><div><dt>Username</dt><dd>{currentAdmin.username || "Not configured"}</dd></div><div><dt>Phone number</dt><dd>{currentAdmin.phoneNumber || "Not provided"}</dd></div><div><dt>Role</dt><dd>{currentAdmin.role}</dd></div><div><dt>Account created</dt><dd>{date(currentAdmin.createdAt)}</dd></div></dl><p className="adminPermissionNote">Profile details are shown securely from the authenticated database account. Passwords are never displayed.</p></div></section>}
  </AdminShell>;
}

function Metric({ icon, label, value, detail, tone = "blue" }: { icon: "products" | "customers" | "orders" | "calendar" | "warning" | "sales" | "package"; label: string; value: string | number; detail: string; tone?: string }) {
  return <article className={`adminMetric ${tone}`}><span><AdminIcon name={icon}/></span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}
function SectionHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <header className="modernSectionHeading"><div><small>{eyebrow}</small><h2>{title}</h2></div>{action || (detail && <span>{detail}</span>)}</header>;
}
function StatusBadge({ status, tone }: { status: string; tone?: "success" | "warning" | "danger" | "info" }) { return <span className={`modernStatus ${tone || statusTone(status)}`}>{status}</span>; }
function EmptyState({ title, text, action, href }: { title: string; text: string; action?: string; href?: string }) { return <div className="modernEmptyState"><span><AdminIcon name="package" size={25}/></span><b>{title}</b><p>{text}</p>{action && href && <Link href={href}>{action}</Link>}</div>; }
function FilterBar({ view, search, filter, options, placeholder }: { view: string; search: string; filter: string; options: string[]; placeholder: string }) {
  return <form className="adminFilterBar" method="get"><input name="view" type="hidden" value={view}/><label><AdminIcon name="search"/><input aria-label={placeholder} defaultValue={search} name="q" placeholder={placeholder}/></label><select aria-label="Filter records" defaultValue={filter || "All"} name="filter">{options.map((option) => <option key={option}>{option}</option>)}</select><button type="submit">Apply filters</button>{(search || (filter && filter !== "All")) && <Link href={`/admin/dashboard?view=${view}`}>Clear</Link>}</form>;
}
function Pagination({ view, search, filter, page, pages }: { view: string; search: string; filter: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (target: number) => {
    const params = new URLSearchParams({ view, page: String(target) });
    if (search) params.set("q", search);
    if (filter && filter !== "All") params.set("filter", filter);
    return `/admin/dashboard?${params.toString()}`;
  };
  return <nav aria-label="Records pagination" className="adminPagination"><Link aria-disabled={page === 1} className={page === 1 ? "disabled" : ""} href={href(Math.max(1, page - 1))}>Previous</Link><span>Page {page} of {pages}</span><Link aria-disabled={page === pages} className={page === pages ? "disabled" : ""} href={href(Math.min(pages, page + 1))}>Next</Link></nav>;
}
function ReportChart({ title, rows, maximum, empty = "No report data yet." }: { title: string; rows: readonly (readonly [string, number])[]; maximum: number; empty?: string }) {
  return <article className="reportCard"><h3>{title}</h3>{rows.length ? <div className="reportBars">{rows.map(([label, count]) => <div key={label}><header><span>{label}</span><b>{count}</b></header><i><em style={{ width: `${Math.max(count ? 6 : 0, (count / maximum) * 100)}%` }}/></i></div>)}</div> : <p>{empty}</p>}</article>;
}
