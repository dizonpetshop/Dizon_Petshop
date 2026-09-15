import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ClientDashboardShell from "@/components/ClientDashboardShell";
import { dashboardViews, type DashboardView } from "@/lib/dashboard-views";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/session";
import { bookGrooming, createPet, reserveProduct, updatePet, updateProfile } from "../actions";

function date(value: Date) {
  if (Number.isNaN(value.getTime())) return "Date unavailable";
  return value.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function time(value: Date) {
  if (Number.isNaN(value.getTime())) return "Time unavailable";
  return value.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
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

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role.toLowerCase() === "admin" || user.accountStatus !== "Active") {
    redirect("/client/login");
  }

  const params = await searchParams;
  const requestedView = params.view;
  const view: DashboardView = dashboardViews.includes(requestedView as DashboardView) ? (requestedView as DashboardView) : "dashboard";
  const customer = await queryOr("customer", () => prisma.customer.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" } },
  }), null);

  const [pets, appointments, productReservations, products, pricing, groomers] = await Promise.all([
    customer
      ? queryOr("pets", () => prisma.pet.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" } }), [])
      : [],
    customer
      ? queryOr("grooming appointments", () => prisma.groomingAppointment.findMany({
          where: { customerId: customer.id },
          include: { pet: true, style: true, groomer: true },
          orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
        }), [])
      : [],
    customer
      ? queryOr("product reservations", () => prisma.productReservation.findMany({
          where: { customerId: customer.id },
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: "desc" },
        }), [])
      : [],
    queryOr("products", () => prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ productGroup: "asc" }, { productName: "asc" }],
    }), []),
    queryOr("grooming prices", () => prisma.styleSizePricing.findMany({ include: { style: true }, orderBy: [{ styleId: "asc" }, { pricingId: "asc" }] }), []),
    queryOr("groomers", () => prisma.groomer.findMany({ where: { isActive: true }, orderBy: { groomerName: "asc" } }), []),
  ]);
  const styles = [...new Map(pricing.map((item) => [item.styleId, item.style])).values()];

  const upcoming = appointments.filter(
    (item) => ["Pending", "Confirmed"].includes(item.status) && item.appointmentDate >= new Date(new Date().toDateString()),
  );
  const activeProductReservations = productReservations.filter((item) =>
    ["Pending", "Confirmed", "Ready for Pickup"].includes(item.status),
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
              <article className="metric"><span>Account status</span><strong>Active</strong><small>Email verified</small></article>
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
            <details className="clientActionPanel"><summary>＋ Add a pet profile</summary><form action={createPet} className="clientActionForm"><label>Pet name<input name="petName" required /></label><label>Species<select name="species" defaultValue="Dog"><option>Dog</option><option>Cat</option><option>Other</option></select></label><label>Breed<input name="breed" /></label><button>Add pet</button></form></details>
            {pets.length ? <div className="clientCardGrid">{pets.map((pet) => <form action={updatePet} className="clientEditCard" key={pet.id}><input type="hidden" name="id" value={pet.id}/><span className="clientCardIcon">🐾</span><label>Pet name<input name="petName" defaultValue={pet.petName} required /></label><label>Species<select name="species" defaultValue={pet.species || "Dog"}><option>Dog</option><option>Cat</option><option>Other</option></select></label><label>Breed<input name="breed" defaultValue={pet.breed || ""} /></label><button>Save pet</button></form>)}</div> : <Empty title="No pets registered" detail="Add your first pet profile above." />}
          </PortalSection>
        </div>

        <div data-dashboard-panel="grooming">
          <PortalSection eyebrow="CARE SCHEDULE" title="Grooming" description="Compare hairstyles, size-based prices, and available groomers, then reserve salon or home service.">
            <div className="groomingCatalog">{styles.map((style) => <article key={style.styleId}><h3>{style.styleName}</h3>{pricing.filter((item) => item.styleId === style.styleId).map((item) => <p key={item.pricingId}><span>{item.petSize}</span><b>{money(item.price)}</b></p>)}</article>)}</div>
            {pets.length && styles.length && groomers.length ? <details className="clientActionPanel" open><summary>Book a grooming appointment</summary><form action={bookGrooming} className="clientActionForm bookingForm"><label>Pet<select name="petId">{pets.map((pet) => <option value={pet.id} key={pet.id}>{pet.petName}</option>)}</select></label><label>Hairstyle / package<select name="styleId">{styles.map((style) => <option value={style.styleId} key={style.styleId}>{style.styleName}</option>)}</select></label><label>Pet size<select name="petSize"><option>Small</option><option>Medium</option><option>Large</option><option>Extra Large</option><option>Giant</option></select></label><label>Groomer<select name="groomerId">{groomers.map((groomer) => <option value={groomer.groomerId} key={groomer.groomerId}>{groomer.groomerName}</option>)}</select></label><label>Service type<select name="bookingType"><option>Salon</option><option>Home Service</option></select></label><label>Date<input name="date" type="date" min={new Date().toISOString().slice(0, 10)} required /></label><label>Time<input name="time" type="time" min="09:00" max="19:00" required /></label><label className="wideField">Home-service address<input name="address" defaultValue={customer?.address || ""} placeholder="Required for home service" /></label><label className="wideField">Special instructions<textarea name="instructions" rows={3} /></label><button>Submit appointment</button></form></details> : <div className="portalHint">Add a pet profile before booking. Grooming reservations require an available package and groomer.</div>}
            {appointments.length ? <div className="clientList">{appointments.map((item) => <article className="clientListItem" key={item.appointmentId.toString()}><div><h3>{item.pet.petName} · {item.style.styleName}</h3><p>{date(item.appointmentDate)} at {time(item.appointmentTime)} · {item.groomer.groomerName}</p><small>{item.reservationCode}</small></div><span className="statusChip">{item.status}</span></article>)}</div> : <Empty title="No grooming appointments" detail="Your grooming schedule will appear here after a reservation is created." />}
          </PortalSection>
        </div>

        <div data-dashboard-panel="products">
          <PortalSection eyebrow="PET ESSENTIALS" title="Available products" description="Browse products that are currently available in the shop.">
            {products.length ? <div className="productBrowseGrid">{products.map((product) => <article className="productBrowseCard" key={product.productId}>{product.image ? <img className="productImage" src={product.image} alt={product.productName} loading="lazy" /> : <div className="productImagePlaceholder" aria-hidden="true">🐾</div>}<small>{product.productGroup} · {product.category}</small><h3>{product.productName}</h3><p>{product.description || "Available for in-store pickup."}</p><div><strong>{money(product.price)}</strong><span>{product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : "Out of stock"}</span></div>{product.stockQuantity > 0 ? <form action={reserveProduct} className="productReserveForm"><input type="hidden" name="productId" value={product.productId}/><label>Qty<input type="number" name="quantity" min="1" max={product.stockQuantity} defaultValue="1" required /></label><label>Payment<select name="paymentMethod"><option>Cash</option><option>GCash</option><option>Maya</option></select></label><button>Reserve</button></form> : <button className="outOfStockButton" disabled>Currently unavailable</button>}</article>)}</div> : <Empty title="No products available" detail="Active inventory will appear here." />}
          </PortalSection>
        </div>

        <div data-dashboard-panel="reservations">
          <PortalSection eyebrow="ORDER HISTORY" title="Reservations" description="Track your product pickups and grooming reservation status.">
            {!appointments.length && !productReservations.length ? <Empty title="No reservations yet" detail="Your product and grooming reservations will appear here." /> : <div className="reservationColumns"><div><h3>Product reservations</h3>{productReservations.length ? <div className="clientList">{productReservations.map((reservation) => <article className="clientListItem" key={reservation.reservationId.toString()}><div><h3>{reservation.items.map((item) => `${item.quantity}× ${item.product.productName}`).join(", ")}</h3><p>{date(reservation.createdAt)} · {money(reservation.totalAmount)}</p><small>{reservation.reservationCode}</small></div><span className="statusChip">{reservation.status}</span></article>)}</div> : <Empty title="No product reservations" detail="Reserved pickup items will appear here." />}</div><div><h3>Grooming reservations</h3>{appointments.length ? <div className="clientList">{appointments.map((item) => <article className="clientListItem" key={item.appointmentId.toString()}><div><h3>{item.pet.petName} · {item.style.styleName}</h3><p>{date(item.appointmentDate)} at {time(item.appointmentTime)}</p><small>{item.reservationCode}</small></div><span className="statusChip">{item.status}</span></article>)}</div> : <Empty title="No grooming reservations" detail="Booked grooming services will appear here." />}</div></div>}
          </PortalSection>
        </div>

        <div data-dashboard-panel="account">
          <PortalSection eyebrow="PERSONAL DETAILS" title="My account" description="Edit your contact information used for reservations and home service.">
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
