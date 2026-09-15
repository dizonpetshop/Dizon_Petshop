"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
  if (!firstName || !surname || !phone) throw new Error("Name and phone number are required.");
  const customer = await ensureCustomer(user);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { firstName, surname, middleInitial, phoneNumber: phone } }),
    prisma.customer.update({ where: { id: customer.id }, data: { customerName: [firstName, middleInitial, surname].filter(Boolean).join(" "), phone, address } }),
  ]);
  finish("account", "Profile updated successfully.");
}

export async function createPet(form: FormData) {
  const user = await requireClient();
  const customer = await ensureCustomer(user);
  const petName = text(form, "petName");
  if (!petName) throw new Error("Pet name is required.");
  await prisma.pet.create({ data: { customerId: customer.id, petName, species: text(form, "species") || null, breed: text(form, "breed") || null } });
  finish("pets", "Pet profile added.");
}

export async function updatePet(form: FormData) {
  const user = await requireClient();
  const customer = await ensureCustomer(user);
  const petId = positiveInteger(form, "id");
  const petName = text(form, "petName");
  if (!petName) throw new Error("Pet name is required.");
  const result = await prisma.pet.updateMany({ where: { id: petId, customerId: customer.id }, data: { petName, species: text(form, "species") || null, breed: text(form, "breed") || null } });
  if (result.count !== 1) throw new Error("Pet profile not found.");
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
  if (!allowed(petSize, petSizes) || !allowed(bookingType, bookingTypes) || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) throw new Error("Complete the appointment details correctly.");
  if (bookingType === "Home Service" && !serviceAddress) throw new Error("A home-service address is required.");
  const appointmentDate = new Date(`${dateValue}T00:00:00.000Z`);
  const appointmentTime = new Date(`1970-01-01T${timeValue}:00.000Z`);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (appointmentDate < today) throw new Error("Choose a future appointment date.");
  const [pet, pricing, groomer, conflict] = await Promise.all([
    prisma.pet.findFirst({ where: { id: petId, customerId: customer.id } }),
    prisma.styleSizePricing.findFirst({ where: { styleId, petSize }, include: { style: true } }),
    prisma.groomer.findFirst({ where: { groomerId, isActive: true } }),
    prisma.groomingAppointment.findFirst({ where: { groomerId, appointmentDate, appointmentTime, status: { in: ["Pending", "Confirmed"] } }, select: { appointmentId: true } }),
  ]);
  if (!pet || !pricing || !groomer) throw new Error("The selected pet, package, size, or groomer is unavailable.");
  if (conflict) throw new Error("That groomer is already booked for this time.");
  const appointment = await prisma.groomingAppointment.create({ data: { reservationCode: reference("GRM"), customerId: customer.id, petId, groomingStyleId: styleId, groomerId, bookingType, serviceAddress, petSize, appointmentDate, appointmentTime, specialInstructions: text(form, "instructions") || null, totalPrice: pricing.price, status: "Pending" } });
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
  if (!allowed(paymentMethod, paymentMethods)) throw new Error("Select Cash, GCash, or Maya.");
  const paymentCode = paymentMethod === "Cash" ? "CSH" : paymentMethod.toUpperCase();
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { productId, isActive: true } });
    if (!product || product.stockQuantity < quantity) throw new Error("The requested quantity is no longer available.");
    const stock = await tx.product.updateMany({ where: { productId, stockQuantity: { gte: quantity } }, data: { stockQuantity: { decrement: quantity } } });
    if (stock.count !== 1) throw new Error("The requested quantity is no longer available.");
    await tx.productReservation.create({ data: { reservationCode: reference(`PRD-${paymentCode}`), customerId: customer.id, totalAmount: product.price.mul(quantity), status: "Pending", reservedUntil: new Date(Date.now() + 48 * 60 * 60 * 1000), items: { create: { productId, quantity, unitPrice: product.price } } } });
  });
  finish("reservations", `Product reserved with ${paymentMethod} selected.`);
}
