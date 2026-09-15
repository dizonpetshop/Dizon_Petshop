import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendGroomingReminder } from "@/lib/mail";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dueBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const completed = await prisma.groomingAppointment.findMany({ where: { status: "Completed", appointmentDate: { lte: dueBefore } }, include: { customer: true, pet: true }, orderBy: { appointmentDate: "desc" }, take: 250 });
  const latestByPet = [...new Map(completed.map((item) => [item.petId, item])).values()];
  let sent = 0;
  let failed = 0;
  for (const appointment of latestByPet.filter((item) => !item.confirmationEmailSentAt && item.customer.email).slice(0, 25)) {
    try {
      await sendGroomingReminder(appointment.customer.email!, { name: appointment.customer.customerName, pet: appointment.pet.petName, lastVisit: appointment.appointmentDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) });
      await prisma.groomingAppointment.updateMany({ where: { appointmentId: appointment.appointmentId, confirmationEmailSentAt: null }, data: { confirmationEmailSentAt: new Date() } });
      sent++;
    } catch (error) {
      console.error(`Grooming reminder failed for appointment ${appointment.appointmentId}`, error);
      failed++;
    }
  }
  return NextResponse.json({ checked: latestByPet.length, sent, failed });
}
