import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Brand from "@/components/Brand";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/session";

export default async function ClientDashboard() {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session?.role !== "User") redirect("/client/login");
  const user = await prisma.user.findUnique({where:{id:session.userId}});
  if (!user || user.role.toLowerCase()==="admin" || user.accountStatus!=="Active") redirect("/client/login");
  const customer = await prisma.customer.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" } },
  });
  const pets = customer ? await prisma.pet.count({where:{customerId:customer.id}}) : 0;
  const appointments = customer ? await prisma.groomingAppointment.findMany({where:{customerId:customer.id,status:{in:["Pending","Confirmed"]},appointmentDate:{gte:new Date(new Date().toDateString())}},include:{pet:true,style:true,groomer:true},orderBy:[{appointmentDate:"asc"},{appointmentTime:"asc"}],take:1}) : [];
  const productReservations = customer ? await prisma.productReservation.count({where:{customerId:customer.id,status:{in:["Pending","Confirmed","Ready for Pickup"]}}}) : 0;
  const next = appointments[0];

  return <main className="dashShell"><aside className="dashSidebar"><Brand /><nav className="dashNav"><a className="active" href="#"><span>⌂</span>Dashboard</a><a href="#"><span>🐾</span>My Pets</a><a href="#"><span>✂</span>Grooming</a><a href="#"><span>▣</span>Products</a><a href="#"><span>◷</span>Reservations</a></nav></aside><section className="dashContent"><header className="dashTop"><div><small>CLIENT PORTAL</small><b>Dizon&apos;s Petshop</b></div><form action="/api/auth/logout" method="post"><button className="logoutButton">Logout</button></form></header><section className="dashHero"><small>GOOD DAY, {session.name.toUpperCase()}</small><h1>Care made beautifully simple.</h1><p>Appointments, pet essentials, and every important update—all in one calm place.</p><a className="primaryButton" href="#">Book Grooming</a></section><section className="metricGrid"><article className="metric"><span>Registered pets</span><strong>{pets}</strong><small>Pet profiles</small></article><article className="metric"><span>Upcoming grooming</span><strong>{appointments.length}</strong><small>Active schedule</small></article><article className="metric"><span>Product reservations</span><strong>{productReservations}</strong><small>Active pickup items</small></article><article className="metric"><span>Account status</span><strong>Active</strong><small>Email verified</small></article></section><section className="dashGrid"><article className="dashPanel"><h2>Next care visit</h2>{next?<div className="scheduleItem"><span>{next.appointmentDate.getDate()}</span><div><b>{next.pet.petName} · {next.style.styleName}</b><small>{next.appointmentTime.toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit"})} · {next.groomer.groomerName}</small></div><em>{next.status.toUpperCase()}</em></div>:<div className="dashboardEmpty"><b>No upcoming appointment</b><small>Your next grooming reservation will appear here.</small></div>}</article><article className="dashPanel"><h2>Quick access</h2><div className="quickGrid"><a href="#">Food & treats</a><a href="#">Shampoo</a><a href="#">Pet profiles</a><a href="#">Reservations</a></div></article></section></section></main>;
}
