"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isPhilippinePhone, notifyAdministrators, requestIp, writeAudit } from "@/lib/operations";
import { readSessionToken, sessionCookieName } from "@/lib/session";
import { sendAppointmentReceived } from "@/lib/mail";

const petSizes = ["Small", "Medium", "Large", "Extra Large", "Giant"] as const;
const bookingTypes = ["Salon", "Home Service"] as const;
const paymentMethods = ["Cash", "GCash", "Maya"] as const;

function text(form: FormData, key: string) { return String(form.get(key) ?? "").trim(); }
function positiveInteger(form: FormData, key: string) {
  const value = Number(form.get(key));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${key}.`);
  return value;
}
function allowed(value: string, values: readonly string[]) { return values.includes(value); }
function reference(prefix: string) { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`.slice(0, 24); }

async function requireClient() {
  const session = await readSessionToken((await cookies()).get(sessionCookieName)?.value);
  if (session?.role !== "User") throw new Error("Client access required.");
  const user = await prisma.user.findFirst({ where: { id: session.userId, role: "User", accountStatus: "Active" } });
  if (!user) throw new Error("Client access required.");
  return user;
}

async function ensureCustomer(user: Awaited<ReturnType<typeof requireClient>>) {
  const existing = await prisma.customer.findFirst({ where: { email: { equals: user.email, mode: "insensitive" } } });
  if (existing) return existing;
  return prisma.customer.create({ data: { customerName: [user.firstName, user.surname].filter(Boolean).join(" ") || "Client", email: user.email, phone: user.phoneNumber || "Not provided" } });
}

function finish(view: string, message: string): never {
  redirect(`/client/dashboard?view=${view}&notice=${encodeURIComponent(message)}`);
}

export async function updateProfile(form: FormData) {
  const user = await requireClient();
  const firstName = text(form, "firstName");
  const surname = text(form, "surname");
  const middleInitial = text(form, "middleInitial").slice(0, 2) || null;
  const phone = text(form, "phone");
  const address = text(form, "address") || null;
  if (!firstName || !surname || !isPhilippinePhone(phone)) throw new Error("Enter a name and a valid Philippine mobile number.");
  const customer = await ensureCustomer(user);
  const ip = await requestIp();
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { firstName, surname, middleInitial, phoneNumber: phone } }),
    prisma.customer.update({ where: { id: customer.id }, data: { customerName: [firstName, middleInitial, surname].filter(Boolean).join(" "), phone, address } }),
    prisma.auditLog.create({ data: { userId: user.id, userName: [firstName, surname].join(" "), role: "Customer", action: "UPDATE", module: "Customer Profile", recordId: String(customer.id), description: "Updated customer contact information.", ipAddress: ip } }),
  ]);
  finish("account", "Profile updated successfully.");
}

export async function createPet(form: FormData) {
  const user = await requireClient();
  const customer = await ensureCustomer(user);
  const petName = text(form, "petName");
  if (!petName) throw new Error("Pet name is required.");
  const pet = await prisma.pet.create({ data: { customerId: customer.id, petName, species: text(form, "species") || null } });
  await writeAudit(prisma, { userId: user.id, name: customer.customerName, role: "Customer" }, "CREATE", "Pet", `Added pet profile for ${petName}.`, pet.id, await requestIp());
  finish("pets", "Pet profile added.");
}

export async function updatePet(form: FormData) {
  const user = await requireClient();
  const customer = await ensureCustomer(user);
  const petId = positiveInteger(form, "id");
  const petName = text(form, "petName");
  if (!petName) throw new Error("Pet name is required.");
  const result = await prisma.pet.updateMany({ where: { id: petId, customerId: customer.id }, data: { petName, species: text(form, "species") || null } });
  if (result.count !== 1) throw new Error("Pet profile not found.");
  await writeAudit(prisma, { userId: user.id, name: customer.customerName, role: "Customer" }, "UPDATE", "Pet", `Updated pet profile for ${petName}.`, petId, await requestIp());
  finish("pets", "Pet profile updated.");
}

export async function bookGrooming(form: FormData) {
  const user = await requireClient();
  const customer = await ensureCustomer(user);
  const petId = positiveInteger(form, "petId");
  const styleId = positiveInteger(form, "styleId");
  const groomerId = positiveInteger(form, "groomerId");
  const petSize = text(form, "petSize");
  const bookingType = text(form, "bookingType");
  const dateValue = text(form, "date");
  const timeValue = text(form, "time");
  const serviceAddress = text(form, "address") || null;
  const contactName = text(form, "contactName") || customer.customerName;
  const contactNumber = text(form, "contactNumber") || customer.phone;
  if (!allowed(petSize, petSizes) || !allowed(bookingType, bookingTypes) || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) throw new Error("Complete the appointment details correctly.");
  if (bookingType === "Home Service" && (!contactName || !serviceAddress || !isPhilippinePhone(contactNumber))) throw new Error("Home service requires a customer name, complete address, and valid Philippine mobile number.");
  const appointmentDate = new Date(`${dateValue}T00:00:00.000Z`);
  const appointmentTime = new Date(`1970-01-01T${timeValue}:00.000Z`);
  const scheduledAt = new Date(`${dateValue}T${timeValue}:00+08:00`);
  const appointmentMinutes = Number(timeValue.slice(0, 2)) * 60 + Number(timeValue.slice(3));
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (appointmentDate < today || scheduledAt.getTime() <= Date.now()) throw new Error("Choose a future appointment schedule.");
  if (appointmentMinutes < 9 * 60 || appointmentMinutes > 19 * 60) throw new Error("Appointments are available from 9:00 AM to 7:00 PM.");
  const slotStart = new Date(appointmentTime.getTime() - 59 * 60 * 1000);
  const slotEnd = new Date(appointmentTime.getTime() + 60 * 60 * 1000);
  const [pet, pricing, groomer, conflict, customerConflict] = await Promise.all([
    prisma.pet.findFirst({ where: { id: petId, customerId: customer.id } }),
    prisma.styleSizePricing.findFirst({ where: { styleId, petSize }, include: { style: true } }),
    prisma.groomer.findFirst({ where: { groomerId, isActive: 1 }, include: { availability: { where: { isActive: true } } } }),
    prisma.groomingAppointment.findFirst({ where: { groomerId, appointmentDate, appointmentTime: { gt: slotStart, lt: slotEnd }, status: { in: ["Pending", "Confirmed"] } }, select: { appointmentId: true } }),
    prisma.groomingAppointment.findFirst({ where: { customerId: customer.id, petId, appointmentDate, appointmentTime, status: { in: ["Pending", "Confirmed"] } }, select: { appointmentId: true } }),
  ]);
  if (!pet || !pricing || !groomer) throw new Error("The selected pet, package, size, or groomer is unavailable.");
  if (groomer.availability.length) {
    const daySchedule = groomer.availability.find((item) => item.dayOfWeek === appointmentDate.getUTCDay());
    if (!daySchedule || appointmentTime < daySchedule.startTime || appointmentTime >= daySchedule.endTime) throw new Error("Groomer is not available for this schedule. Please select another time or groomer.");
  }
  if (conflict) throw new Error("Groomer is no longer available for this schedule. Please select another groomer.");
  if (customerConflict) throw new Error("This pet already has an appointment at the selected schedule.");
  const code = reference("GRM");
  const ip = await requestIp();
  const appointment = await prisma.$transaction(async (tx) => {
    const currentConflict = await tx.groomingAppointment.findFirst({ where: { groomerId, appointmentDate, appointmentTime: { gt: slotStart, lt: slotEnd }, status: { in: ["Pending", "Confirmed"] } }, select: { appointmentId: true } });
    if (currentConflict) throw new Error("Groomer is no longer available for this schedule. Please select another groomer.");
    const created = await tx.groomingAppointment.create({ data: { reservationCode: code, customerId: customer.id, petId, groomingStyleId: styleId, groomerId, bookingType, contactName, contactNumber, serviceAddress: bookingType === "Home Service" ? serviceAddress : null, petSize, appointmentDate, appointmentTime, specialInstructions: text(form, "instructions") || null, totalPrice: pricing.price, status: "Pending" } });
    await notifyAdministrators(tx, { eventKey: `appointment.created.${created.appointmentId}`, title: bookingType === "Home Service" ? "New home service request" : "New grooming appointment", message: `${customer.customerName} booked ${pet.petName} with ${groomer.groomerName}.`, type: bookingType === "Home Service" ? "HOME_SERVICE" : "GROOMING", relatedType: "appointment", relatedId: created.appointmentId, link: `/admin/dashboard?view=reservations&q=${code}` });
    await writeAudit(tx, { userId: user.id, name: customer.customerName, role: "Customer" }, "CREATE", "Grooming Appointment", `Created ${bookingType === "Home Service" ? "home service" : "store grooming"} appointment ${code}.`, created.appointmentId, ip);
    return created;
  }, { isolationLevel: "Serializable" });
  let notice = "Grooming appointment submitted and email confirmation sent.";
  if (customer.email) {
    try {
      await sendAppointmentReceived(customer.email, { name: customer.customerName, pet: pet.petName, style: pricing.style.styleName, groomer: groomer.groomerName, date: dateValue, time: timeValue, bookingType, reference: appointment.reservationCode });
    } catch (error) {
      console.error("Appointment saved but confirmation email failed", error);
      notice = "Appointment saved, but the confirmation email could not be sent.";
    }
  } else notice = "Appointment saved. Add an email to the customer profile to receive confirmations.";
  finish("reservations", notice);
}

export async function reserveProduct(form: FormData) {
  const user = await requireClient();
  const customer = await ensureCustomer(user);
  const productId = positiveInteger(form, "productId");
  const quantity = positiveInteger(form, "quantity");
  const paymentMethod = text(form, "paymentMethod");
  const contactNumber = text(form, "contactNumber") || customer.phone;
  const deliveryAddress = text(form, "address") || customer.address;
  const pickupDate = text(form, "pickupDate");
  const pickupTime = text(form, "pickupTime");
  if (!allowed(paymentMethod, paymentMethods)) throw new Error("Select Cash, GCash, or Maya.");
  if (!isPhilippinePhone(contactNumber) || !deliveryAddress) throw new Error("A valid Philippine contact number and complete address are required. Update your account details or complete the reservation form.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || !/^\d{2}:\d{2}$/.test(pickupTime)) throw new Error("Choose a valid pickup date and time.");
  const pickupAt = new Date(`${pickupDate}T${pickupTime}:00+08:00`);
  const pickupMinutes = Number(pickupTime.slice(0, 2)) * 60 + Number(pickupTime.slice(3));
  if (Number.isNaN(pickupAt.getTime()) || pickupAt.getTime() <= Date.now() || pickupMinutes < 9 * 60 || pickupMinutes > 19 * 60) throw new Error("Choose a future pickup time between 9:00 AM and 7:00 PM.");
  if (pickupAt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) throw new Error("Pickup must be scheduled within the next 30 days.");
  const paymentCode = paymentMethod === "Cash" ? "CSH" : paymentMethod.toUpperCase();
  const reservationCode = reference(`PRD-${paymentCode}`);
  const ip = await requestIp();
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { productId, isActive: 1 } });
    if (!product) throw new Error("The selected product is unavailable.");
    const stock = await tx.product.updateMany({ where: { productId, isActive: 1, stockQuantity: { gte: quantity } }, data: { stockQuantity: { decrement: quantity } } });
    if (stock.count !== 1) throw new Error("The requested quantity is no longer available.");
    const reservation = await tx.productReservation.create({ data: { reservationCode, customerId: customer.id, customerName: customer.customerName, contactNumber, deliveryAddress, totalAmount: product.price.mul(quantity), status: "Pending", reservedUntil: pickupAt, items: { create: { productId, quantity, unitPrice: product.price } } } });
    await notifyAdministrators(tx, { eventKey: `product-reservation.created.${reservation.reservationId}`, title: "New product reservation", message: `${customer.customerName} reserved ${quantity} x ${product.productName}.`, type: "PRODUCT_RESERVATION", relatedType: "product_reservation", relatedId: reservation.reservationId, link: `/admin/dashboard?view=orders&q=${reservationCode}` });
    await writeAudit(tx, { userId: user.id, name: customer.customerName, role: "Customer" }, "CREATE", "Product Reservation", `Created product reservation ${reservationCode}.`, reservation.reservationId, ip);
  }, { isolationLevel: "Serializable" });
  const pickupLabel = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(pickupAt);
  finish("reservations", `Product reserved for pickup on ${pickupLabel}. Payment: ${paymentMethod}.`);
}

export async function cancelGroomingAppointment(form: FormData) {
  const user = await requireClient();
  const customer = await ensureCustomer(user);
  const appointmentId = BigInt(text(form, "id"));
  const ip = await requestIp();
  await prisma.$transaction(async (tx) => {
    const appointment = await tx.groomingAppointment.findFirst({ where: { appointmentId, customerId: customer.id, status: { in: ["Pending", "Confirmed"] } } });
    if (!appointment) throw new Error("This appointment can no longer be cancelled.");
    await tx.groomingAppointment.update({ where: { appointmentId }, data: { status: "Cancelled", cancelledAt: new Date() } });
    await notifyAdministrators(tx, { eventKey: `appointment.cancelled.${appointmentId}`, title: "Appointment cancelled", message: `${customer.customerName} cancelled appointment ${appointment.reservationCode}.`, type: "GROOMING_CANCELLATION", relatedType: "appointment", relatedId: appointmentId, link: `/admin/dashboard?view=reservations&q=${appointment.reservationCode}` });
    await writeAudit(tx, { userId: user.id, name: customer.customerName, role: "Customer" }, "CANCEL", "Grooming Appointment", `Cancelled appointment ${appointment.reservationCode}.`, appointmentId, ip);
  });
  finish("reservations", "Reservation cancelled successfully.");
}

export async function cancelProductReservation(form: FormData) {
  const user = await requireClient();
  const customer = await ensureCustomer(user);
  const reservationId = BigInt(text(form, "id"));
  const ip = await requestIp();
  await prisma.$transaction(async (tx) => {
    const reservation = await tx.productReservation.findFirst({ where: { reservationId, customerId: customer.id, status: { in: ["Pending", "Approved"] } }, include: { items: true } });
    if (!reservation) throw new Error("This product reservation can no longer be cancelled.");
    for (const item of reservation.items) await tx.product.update({ where: { productId: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
    await tx.productReservation.update({ where: { reservationId }, data: { status: "Cancelled" } });
    await notifyAdministrators(tx, { eventKey: `product-reservation.cancelled.${reservationId}`, title: "Product reservation cancelled", message: `${customer.customerName} cancelled reservation ${reservation.reservationCode}.`, type: "PRODUCT_CANCELLATION", relatedType: "product_reservation", relatedId: reservationId, link: `/admin/dashboard?view=orders&q=${reservation.reservationCode}` });
    await writeAudit(tx, { userId: user.id, name: customer.customerName, role: "Customer" }, "CANCEL", "Product Reservation", `Cancelled product reservation ${reservation.reservationCode}.`, reservationId, ip);
  });
  finish("reservations", "Reservation cancelled successfully.");
}
