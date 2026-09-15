import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ClientDashboardShell from "@/components/ClientDashboardShell";
import { dashboardViews, type DashboardView } from "@/lib/dashboard-views";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/session";

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

async function queryOr<T>(label: string, query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch (error) {
    console.error(`[client-dashboard] ${label} query failed`, error);
    return fallback;
  }
}

export default async function ClientDashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session?.role !== "User") redirect("/client/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role.toLowerCase() === "admin" || user.accountStatus !== "Active") {
    redirect("/client/login");
  }

  const requestedView = (await searchParams).view;
  const view: DashboardView = dashboardViews.includes(requestedView as DashboardView) ? (requestedView as DashboardView) : "dashboard";
  const customer = await queryOr("customer", prisma.customer.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" } },
  }), null);

  const [pets, appointments, productReservations, products] = await Promise.all([
    customer
      ? queryOr("pets", prisma.pet.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" } }), [])
      : [],
    customer
      ? queryOr("grooming appointments", prisma.groomingAppointment.findMany({
          where: { customerId: customer.id },
          include: { pet: true, style: true, groomer: true },
          orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
        }), [])
      : [],
    customer
      ? queryOr("product reservations", prisma.productReservation.findMany({
          where: { customerId: customer.id },
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: "desc" },
        }), [])
      : [],
    queryOr("products", prisma.product.findMany({
      where: { isActive: true, stockQuantity: { gt: 0 } },
      orderBy: [{ productGroup: "asc" }, { productName: "asc" }],
    }), []),
  ]);

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
            {pets.length ? <div className="clientCardGrid">{pets.map((pet) => <article className="clientCard" key={pet.id}><span className="clientCardIcon">🐾</span><div><h3>{pet.petName}</h3><p>{[pet.species, pet.breed].filter(Boolean).join(" · ") || "Pet details not yet provided"}</p></div></article>)}</div> : <Empty title="No pets registered" detail="Ask the shop to add your pet profile to this account." />}
          </PortalSection>
        </div>

        <div data-dashboard-panel="grooming">
          <PortalSection eyebrow="CARE SCHEDULE" title="Grooming" description="Review your upcoming and previous grooming appointments.">
            {appointments.length ? <div className="clientList">{appointments.map((item) => <article className="clientListItem" key={item.appointmentId.toString()}><div><h3>{item.pet.petName} · {item.style.styleName}</h3><p>{date(item.appointmentDate)} at {time(item.appointmentTime)} · {item.groomer.groomerName}</p><small>{item.reservationCode}</small></div><span className="statusChip">{item.status}</span></article>)}</div> : <Empty title="No grooming appointments" detail="Your grooming schedule will appear here after a reservation is created." />}
          </PortalSection>
        </div>

        <div data-dashboard-panel="products">
          <PortalSection eyebrow="PET ESSENTIALS" title="Available products" description="Browse products that are currently available in the shop.">
            {products.length ? <div className="productBrowseGrid">{products.map((product) => <article className="productBrowseCard" key={product.productId}><small>{product.productGroup}</small><h3>{product.productName}</h3><p>{product.description || product.category}</p><div><strong>{money(product.price)}</strong><span>{product.stockQuantity} in stock</span></div></article>)}</div> : <Empty title="No products available" detail="Available inventory will appear here." />}
          </PortalSection>
        </div>

        <div data-dashboard-panel="reservations">
          <PortalSection eyebrow="ORDER HISTORY" title="Reservations" description="Track your product pickups and grooming reservation status.">
            {!appointments.length && !productReservations.length ? <Empty title="No reservations yet" detail="Your product and grooming reservations will appear here." /> : <div className="reservationColumns"><div><h3>Product reservations</h3>{productReservations.length ? <div className="clientList">{productReservations.map((reservation) => <article className="clientListItem" key={reservation.reservationId.toString()}><div><h3>{reservation.items.map((item) => `${item.quantity}× ${item.product.productName}`).join(", ")}</h3><p>{date(reservation.createdAt)} · {money(reservation.totalAmount)}</p><small>{reservation.reservationCode}</small></div><span className="statusChip">{reservation.status}</span></article>)}</div> : <Empty title="No product reservations" detail="Reserved pickup items will appear here." />}</div><div><h3>Grooming reservations</h3>{appointments.length ? <div className="clientList">{appointments.map((item) => <article className="clientListItem" key={item.appointmentId.toString()}><div><h3>{item.pet.petName} · {item.style.styleName}</h3><p>{date(item.appointmentDate)} at {time(item.appointmentTime)}</p><small>{item.reservationCode}</small></div><span className="statusChip">{item.status}</span></article>)}</div> : <Empty title="No grooming reservations" detail="Booked grooming services will appear here." />}</div></div>}
          </PortalSection>
        </div>

        <div data-dashboard-panel="account">
          <PortalSection eyebrow="PERSONAL DETAILS" title="My account" description="Your profile and contact information.">
            <dl className="accountDetails"><div><dt>Name</dt><dd>{[user.firstName, user.middleInitial, user.surname].filter(Boolean).join(" ") || session.name}</dd></div><div><dt>Email address</dt><dd>{user.email}</dd></div><div><dt>Phone number</dt><dd>{user.phoneNumber || customer?.phone || "Not provided"}</dd></div><div><dt>Address</dt><dd>{customer?.address || "Not provided"}</dd></div><div><dt>Account status</dt><dd><span className="statusChip">{user.accountStatus}</span></dd></div><div><dt>Member since</dt><dd>{date(user.createdAt)}</dd></div></dl>
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
