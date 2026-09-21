import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ClientDashboardShell from "@/components/ClientDashboardShell";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import GroomingBookingForm from "@/components/GroomingBookingForm";
import ProductReserveForm from "@/components/ProductReserveForm";
import { dashboardViews, type DashboardView } from "@/lib/dashboard-views";
import { prisma } from "@/lib/prisma";
import { productImageSrc, productImageUrl } from "@/lib/product-image";
import { readSessionToken, sessionCookieName } from "@/lib/session";
import { cancelGroomingAppointment, cancelProductReservation, createPet, updatePet, updateProfile } from "../actions";

function date(value: Date) {
  if (Number.isNaN(value.getTime())) return "Date unavailable";
  return value.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
}

function time(value: Date) {
  if (Number.isNaN(value.getTime())) return "Time unavailable";
  return value.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}

function money(value: { toString(): string }) {
  const amount = Number(value.toString());
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount)
    : "Price unavailable";
}

async function queryOr<T>(label: string, query: () => Promise<T>, fallback: T): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await query();
    } catch (error) {
      console.error(`[client-dashboard] ${label} query failed (attempt ${attempt})`, error);
      if (attempt === 2) return fallback;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  return fallback;
}

export default async function ClientDashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; notice?: string }>;
}) {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session?.role !== "User") redirect("/client/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, accountStatus: true, email: true, firstName: true, middleInitial: true, surname: true, phoneNumber: true, createdAt: true } });
  if (!user || user.role !== "User" || user.accountStatus !== "Active") {
    redirect("/client/login");
  }

  const params = await searchParams;
  const requestedView = params.view;
  const view: DashboardView = dashboardViews.includes(requestedView as DashboardView) ? (requestedView as DashboardView) : "dashboard";
  const customer = await queryOr("customer", () => prisma.customer.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" } },
    select: { id: true, customerName: true, phone: true, address: true, loyaltyStamps: true, rewardAvailable: true, rewardRedeemedAt: true },
  }), null);

  const [products, pets, appointments, productReservations, pricing, groomers] = await Promise.all([
    queryOr("products", () => prisma.product.findMany({
      select: { productId: true, productName: true, category: true, productGroup: true, price: true, stockQuantity: true, isActive: true, description: true },
      orderBy: [{ productGroup: "asc" }, { productName: "asc" }],
    }).then((rows) => rows.map((row) => ({ ...row, image: productImageUrl(row.productId) }))), []),
    customer
      ? queryOr("pets", () => prisma.pet.findMany({ where: { customerId: customer.id }, select: { id: true, petName: true, species: true }, orderBy: { createdAt: "desc" } }), [])
      : [],
    customer
      ? queryOr("grooming appointments", () => prisma.groomingAppointment.findMany({
          where: { customerId: customer.id },
          include: { pet: { select: { id: true, petName: true } }, style: { select: { styleId: true, styleName: true } }, groomer: { select: { groomerId: true, groomerName: true } } },
          orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
        }), [])
      : [],
    customer
      ? queryOr("product reservations", () => prisma.productReservation.findMany({
          where: { customerId: customer.id },
          include: { items: { include: { product: { select: { productId: true, productName: true } } } } },
          orderBy: { createdAt: "desc" },
        }), [])
      : [],
    queryOr("grooming prices", () => prisma.styleSizePricing.findMany({ include: { style: true }, orderBy: [{ styleId: "asc" }, { pricingId: "asc" }] }), []),
    queryOr("groomers", () => prisma.groomer.findMany({ where: { isActive: 1 }, orderBy: { groomerName: "asc" } }), []),
  ]);
  const styles = [...new Map(pricing.map((item) => [item.styleId, item.style])).values()];

  const upcoming = appointments.filter(
    (item) => ["Pending", "Confirmed"].includes(item.status) && item.appointmentDate >= new Date(new Date().toDateString()),
  );
  const activeProductReservations = productReservations.filter((item) =>
    ["Pending", "Approved", "Ready for Pickup"].includes(item.status),
  );
  const next = [...upcoming].sort(
    (a, b) => a.appointmentDate.getTime() - b.appointmentDate.getTime() || a.appointmentTime.getTime() - b.appointmentTime.getTime(),
  )[0];

  return (
    <ClientDashboardShell initialView={view}>
        {params.notice && <div className="portalNotice" role="status">{params.notice}</div>}
        <div data-dashboard-panel="dashboard">
            <section className="dashHero">
              <small>GOOD DAY, {(session.name || "CLIENT").toUpperCase()}</small>
              <h1>Care made beautifully simple.</h1>
              <p>Appointments, pet essentials, and every important update—all in one calm place.</p>
              <a className="primaryButton" data-dashboard-view="grooming" href="/client/dashboard?view=grooming">View Grooming</a>
            </section>
            <section className="metricGrid">
              <article className="metric"><span>Registered pets</span><strong>{pets.length}</strong><small>Pet profiles</small></article>
              <article className="metric"><span>Upcoming grooming</span><strong>{upcoming.length}</strong><small>Active schedule</small></article>
              <article className="metric"><span>Product reservations</span><strong>{activeProductReservations.length}</strong><small>Active pickup items</small></article>
              <article className="metric"><span>Loyalty stamps</span><strong>{customer?.loyaltyStamps || 0}/10</strong><small>{customer?.rewardAvailable ? "Reward available" : "Progress toward VIP reward"}</small></article>
            </section>
            <section className="dashGrid">
              <article className="dashPanel">
                <h2>Next care visit</h2>
                {next ? (
                  <div className="scheduleItem"><span>{next.appointmentDate.getDate()}</span><div><b>{next.pet.petName} · {next.style.styleName}</b><small>{date(next.appointmentDate)} · {time(next.appointmentTime)} · {next.groomer.groomerName}</small></div><em>{next.status.toUpperCase()}</em></div>
                ) : <Empty title="No upcoming appointment" detail="Your next grooming reservation will appear here." />}
              </article>
              <article className="dashPanel"><h2>Quick access</h2><div className="quickGrid"><a data-dashboard-view="products" href="/client/dashboard?view=products">Food & treats</a><a data-dashboard-view="products" href="/client/dashboard?view=products">Shampoo</a><a data-dashboard-view="pets" href="/client/dashboard?view=pets">Pet profiles</a><a data-dashboard-view="reservations" href="/client/dashboard?view=reservations">Reservations</a></div></article>
            </section>
        </div>

        <div data-dashboard-panel="pets">
          <PortalSection eyebrow="PET PROFILES" title="My pets" description="The pets registered under your customer account.">
            <details className="clientActionPanel"><summary>+ Add a pet profile</summary><form action={createPet} className="clientActionForm"><label>Pet name<input name="petName" required /></label><label>Pet type<select name="species" defaultValue="Dog"><option>Dog</option><option>Cat</option><option>Other</option></select></label><button>Add pet</button></form></details>
            {pets.length ? <div className="clientCardGrid">{pets.map((pet) => <form action={updatePet} className="clientEditCard" key={pet.id}><input type="hidden" name="id" value={pet.id}/><span className="clientCardIcon">P</span><label>Pet name<input name="petName" defaultValue={pet.petName} required /></label><label>Pet type<select name="species" defaultValue={pet.species || "Dog"}><option>Dog</option><option>Cat</option><option>Other</option></select></label><button>Save pet</button></form>)}</div> : <Empty title="No pets registered" detail="Add your first pet profile above." />}
          </PortalSection>
        </div>

        <div data-dashboard-panel="grooming">
          <PortalSection eyebrow="CARE SCHEDULE" title="Grooming" description="Compare hairstyles, size-based prices, and available groomers, then reserve salon or home service.">
            <div className="groomingCatalog">{styles.map((style) => <article key={style.styleId}><h3>{style.styleName}</h3>{pricing.filter((item) => item.styleId === style.styleId).map((item) => <p key={item.pricingId}><span>{item.petSize}</span><b>{money(item.price)}</b></p>)}</article>)}</div>
            {pets.length && styles.length && groomers.length ? <details className="clientActionPanel" open><summary>Book a grooming appointment</summary><GroomingBookingForm address={customer?.address || ""} customerName={customer?.customerName || [user.firstName, user.surname].filter(Boolean).join(" ")} groomers={groomers.map((item) => ({ id: item.groomerId, label: item.groomerName }))} minimumDate={new Date().toISOString().slice(0, 10)} pets={pets.map((item) => ({ id: item.id, label: item.petName }))} phone={customer?.phone || user.phoneNumber || ""} styles={styles.map((item) => ({ id: item.styleId, label: item.styleName }))}/></details> : <div className="portalHint">Add a pet profile before booking. Grooming reservations require an available package and groomer.</div>}
            {appointments.length ? <div className="clientList">{appointments.map((item) => <article className="clientListItem" key={item.appointmentId.toString()}><div><h3>{item.pet.petName} - {item.style.styleName}</h3><p>{date(item.appointmentDate)} at {time(item.appointmentTime)} - {item.groomer.groomerName}</p><small>{item.reservationCode} - <b>{item.bookingType === "Home Service" ? "HOME SERVICE" : "STORE SERVICE"}</b></small></div><div className="clientRecordActions"><span className="statusChip">{item.status}</span>{["Pending", "Confirmed"].includes(item.status) && <form action={cancelGroomingAppointment}><input name="id" type="hidden" value={item.appointmentId.toString()}/><ConfirmSubmitButton className="clientCancelButton" confirmMessage="Cancel this grooming appointment?" pendingText="Cancelling...">Cancel</ConfirmSubmitButton></form>}</div></article>)}</div> : <Empty title="No grooming appointments" detail="Your grooming schedule will appear here after a reservation is created." />}
          </PortalSection>
        </div>

        <div data-dashboard-panel="products">
          <PortalSection eyebrow="PET ESSENTIALS" title="Available products" description="Browse products that are currently available in the shop.">
            {products.length ? <div className="productBrowseGrid">{products.map((product) => <article className="productBrowseCard" key={product.productId}><img className="productImage" src={productImageSrc(product.image, product.productName, product.category, product.productId)} alt={product.productName} loading="lazy" /><small>{product.productGroup} - {product.category}</small><h3>{product.productName}</h3><p>{product.description || "Available for in-store pickup."}</p><div><strong>{money(product.price)}</strong><span>{product.isActive && product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : "Unavailable"}</span></div>{product.isActive && product.stockQuantity > 0 ? <ProductReserveForm address={customer?.address || ""} phone={customer?.phone || user.phoneNumber || ""} productId={product.productId} productName={product.productName} stock={product.stockQuantity} unitPrice={Number(product.price.toString())}/> : <button className="outOfStockButton" disabled>Currently unavailable</button>}</article>)}</div> : <Empty title="No products available" detail="Inventory will appear here." />}
          </PortalSection>
        </div>

        <div data-dashboard-panel="reservations">
          <PortalSection eyebrow="ORDER HISTORY" title="Reservations" description="Track your product pickups and grooming reservation status.">
            {!appointments.length && !productReservations.length ? <Empty title="No reservations yet" detail="Your product and grooming reservations will appear here." /> : <div className="reservationColumns"><div><h3>Product reservations</h3>{productReservations.length ? <div className="clientList">{productReservations.map((reservation) => <article className="clientListItem" key={reservation.reservationId.toString()}><div><h3>{reservation.items.map((item) => `${item.quantity} x ${item.product.productName}`).join(", ")}</h3><p>Pickup: {date(reservation.reservedUntil)} at {time(reservation.reservedUntil)} - {money(reservation.totalAmount)}</p><small>{reservation.reservationCode} - Reserved {date(reservation.createdAt)}</small></div><div className="clientRecordActions"><span className="statusChip">{reservation.status}</span>{["Pending", "Approved"].includes(reservation.status) && <form action={cancelProductReservation}><input name="id" type="hidden" value={reservation.reservationId.toString()}/><ConfirmSubmitButton className="clientCancelButton" confirmMessage="Cancel this product reservation? Reserved stock will be released." pendingText="Cancelling...">Cancel</ConfirmSubmitButton></form>}</div></article>)}</div> : <Empty title="No product reservations" detail="Reserved pickup items will appear here." />}</div><div><h3>Grooming reservations</h3>{appointments.length ? <div className="clientList">{appointments.map((item) => <article className="clientListItem" key={item.appointmentId.toString()}><div><h3>{item.pet.petName} - {item.style.styleName}</h3><p>{date(item.appointmentDate)} at {time(item.appointmentTime)}</p><small>{item.reservationCode} - {item.bookingType === "Home Service" ? "HOME SERVICE" : "STORE SERVICE"}</small></div><span className="statusChip">{item.status}</span></article>)}</div> : <Empty title="No grooming reservations" detail="Booked grooming services will appear here." />}</div></div>}
          </PortalSection>
        </div>

        <div data-dashboard-panel="account">
          <PortalSection eyebrow="PERSONAL DETAILS" title="My account" description="Edit your contact information used for reservations and home service.">
            <section className="loyaltyCard"><div><small>LOYALTY PROGRESS</small><h3>{customer?.loyaltyStamps || 0}/10 stamps</h3><p>{customer?.rewardAvailable ? "VIP / Reward Available" : `${10 - (customer?.loyaltyStamps || 0)} more stamps until your reward.`}</p></div><div aria-label={`${customer?.loyaltyStamps || 0} of 10 loyalty stamps`} className="stampTrack">{Array.from({ length: 10 }, (_, index) => <span className={index < (customer?.loyaltyStamps || 0) ? "earned" : ""} key={index}>{index + 1}</span>)}</div></section>
            <form action={updateProfile} className="profileEditForm"><label>First name<input name="firstName" defaultValue={user.firstName || ""} required /></label><label>Middle initial<input name="middleInitial" defaultValue={user.middleInitial || ""} maxLength={2} /></label><label>Surname<input name="surname" defaultValue={user.surname || ""} required /></label><label>Email address<input value={user.email} readOnly /></label><label>Phone number<input name="phone" defaultValue={user.phoneNumber || customer?.phone || ""} required /></label><label className="wideField">Address<textarea name="address" defaultValue={customer?.address || ""} rows={3} /></label><div className="profileMeta"><span>Account: <b>{user.accountStatus}</b></span><span>Member since: <b>{date(user.createdAt)}</b></span></div><button>Save profile</button></form>
          </PortalSection>
        </div>
    </ClientDashboardShell>
  );
}

function PortalSection({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="clientView"><header className="clientViewHeader"><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></header>{children}</section>;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="dashboardEmpty"><b>{title}</b><small>{detail}</small></div>;
}
