import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Brand from "@/components/Brand";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/session";

const views = ["dashboard", "pets", "grooming", "products", "reservations", "account"] as const;
type View = (typeof views)[number];

const navigation: { view: View; icon: string; label: string }[] = [
  { view: "dashboard", icon: "⌂", label: "Dashboard" },
  { view: "pets", icon: "🐾", label: "My Pets" },
  { view: "grooming", icon: "✂", label: "Grooming" },
  { view: "products", icon: "▣", label: "Products" },
  { view: "reservations", icon: "◷", label: "Reservations" },
  { view: "account", icon: "●", label: "My Account" },
];

function date(value: Date) {
  return value.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function time(value: Date) {
  return value.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

function money(value: { toString(): string }) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value.toString()));
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
  const view: View = views.includes(requestedView as View) ? (requestedView as View) : "dashboard";
  const customer = await prisma.customer.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" } },
  });

  const [pets, appointments, productReservations, products] = await Promise.all([
    customer
      ? prisma.pet.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" } })
      : [],
    customer
      ? prisma.groomingAppointment.findMany({
          where: { customerId: customer.id },
          include: { pet: true, style: true, groomer: true },
          orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
        })
      : [],
    customer
      ? prisma.productReservation.findMany({
          where: { customerId: customer.id },
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [],
    prisma.product.findMany({
      where: { isActive: true, stockQuantity: { gt: 0 } },
      orderBy: [{ productGroup: "asc" }, { productName: "asc" }],
    }),
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
    <main className="dashShell">
      <aside className="dashSidebar">
        <Brand />
        <nav className="dashNav" aria-label="Client portal">
          {navigation.map((item) => (
            <Link
              className={view === item.view ? "active" : undefined}
              href={item.view === "dashboard" ? "/client/dashboard" : `/client/dashboard?view=${item.view}`}
              key={item.view}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="dashContent">
        <header className="dashTop">
          <div><small>CLIENT PORTAL</small><b>Dizon&apos;s Petshop</b></div>
          <form action="/api/auth/logout" method="post"><button className="logoutButton">Logout</button></form>
        </header>

        {view === "dashboard" && (
          <>
            <section className="dashHero">
              <small>GOOD DAY, {session.name.toUpperCase()}</small>
              <h1>Care made beautifully simple.</h1>
              <p>Appointments, pet essentials, and every important update—all in one calm place.</p>
              <Link className="primaryButton" href="/client/dashboard?view=grooming">View Grooming</Link>
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
              <article className="dashPanel"><h2>Quick access</h2><div className="quickGrid"><Link href="/client/dashboard?view=products">Food & treats</Link><Link href="/client/dashboard?view=products">Shampoo</Link><Link href="/client/dashboard?view=pets">Pet profiles</Link><Link href="/client/dashboard?view=reservations">Reservations</Link></div></article>
            </section>
          </>
        )}

        {view === "pets" && (
          <PortalSection eyebrow="PET PROFILES" title="My pets" description="The pets registered under your customer account.">
            {pets.length ? <div className="clientCardGrid">{pets.map((pet) => <article className="clientCard" key={pet.id}><span className="clientCardIcon">🐾</span><div><h3>{pet.petName}</h3><p>{[pet.species, pet.breed].filter(Boolean).join(" · ") || "Pet details not yet provided"}</p></div></article>)}</div> : <Empty title="No pets registered" detail="Ask the shop to add your pet profile to this account." />}
          </PortalSection>
        )}

        {view === "grooming" && (
          <PortalSection eyebrow="CARE SCHEDULE" title="Grooming" description="Review your upcoming and previous grooming appointments.">
            {appointments.length ? <div className="clientList">{appointments.map((item) => <article className="clientListItem" key={item.appointmentId.toString()}><div><h3>{item.pet.petName} · {item.style.styleName}</h3><p>{date(item.appointmentDate)} at {time(item.appointmentTime)} · {item.groomer.groomerName}</p><small>{item.reservationCode}</small></div><span className="statusChip">{item.status}</span></article>)}</div> : <Empty title="No grooming appointments" detail="Your grooming schedule will appear here after a reservation is created." />}
          </PortalSection>
        )}

        {view === "products" && (
          <PortalSection eyebrow="PET ESSENTIALS" title="Available products" description="Browse products that are currently available in the shop.">
            {products.length ? <div className="productBrowseGrid">{products.map((product) => <article className="productBrowseCard" key={product.productId}><small>{product.productGroup}</small><h3>{product.productName}</h3><p>{product.description || product.category}</p><div><strong>{money(product.price)}</strong><span>{product.stockQuantity} in stock</span></div></article>)}</div> : <Empty title="No products available" detail="Available inventory will appear here." />}
          </PortalSection>
        )}

        {view === "reservations" && (
          <PortalSection eyebrow="ORDER HISTORY" title="Reservations" description="Track your product pickups and grooming reservation status.">
            {!appointments.length && !productReservations.length ? <Empty title="No reservations yet" detail="Your product and grooming reservations will appear here." /> : <div className="reservationColumns"><div><h3>Product reservations</h3>{productReservations.length ? <div className="clientList">{productReservations.map((reservation) => <article className="clientListItem" key={reservation.reservationId.toString()}><div><h3>{reservation.items.map((item) => `${item.quantity}× ${item.product.productName}`).join(", ")}</h3><p>{date(reservation.createdAt)} · {money(reservation.totalAmount)}</p><small>{reservation.reservationCode}</small></div><span className="statusChip">{reservation.status}</span></article>)}</div> : <Empty title="No product reservations" detail="Reserved pickup items will appear here." />}</div><div><h3>Grooming reservations</h3>{appointments.length ? <div className="clientList">{appointments.map((item) => <article className="clientListItem" key={item.appointmentId.toString()}><div><h3>{item.pet.petName} · {item.style.styleName}</h3><p>{date(item.appointmentDate)} at {time(item.appointmentTime)}</p><small>{item.reservationCode}</small></div><span className="statusChip">{item.status}</span></article>)}</div> : <Empty title="No grooming reservations" detail="Booked grooming services will appear here." />}</div></div>}
          </PortalSection>
        )}

        {view === "account" && (
          <PortalSection eyebrow="PERSONAL DETAILS" title="My account" description="Your profile and contact information.">
            <dl className="accountDetails"><div><dt>Name</dt><dd>{[user.firstName, user.middleInitial, user.surname].filter(Boolean).join(" ") || session.name}</dd></div><div><dt>Email address</dt><dd>{user.email}</dd></div><div><dt>Phone number</dt><dd>{user.phoneNumber || customer?.phone || "Not provided"}</dd></div><div><dt>Address</dt><dd>{customer?.address || "Not provided"}</dd></div><div><dt>Account status</dt><dd><span className="statusChip">{user.accountStatus}</span></dd></div><div><dt>Member since</dt><dd>{date(user.createdAt)}</dd></div></dl>
          </PortalSection>
        )}
      </section>
    </main>
  );
}

function PortalSection({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="clientView"><header className="clientViewHeader"><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></header>{children}</section>;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="dashboardEmpty"><b>{title}</b><small>{detail}</small></div>;
}
