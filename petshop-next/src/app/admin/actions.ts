"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isPhilippinePhone, notifyAdministrators, requestIp, writeAudit } from "@/lib/operations";
import { readSessionToken, sessionCookieName } from "@/lib/session";
import { sendAppointmentStatus } from "@/lib/mail";

const accountStatuses = ["Active", "Suspended"] as const;
const productGroups = ["Food", "Shampoo", "Other"] as const;
const groomingStatuses = ["Pending", "Confirmed", "Completed", "Cancelled"] as const;
const productReservationStatuses = ["Pending", "Approved", "Ready for Pickup", "Completed", "Cancelled"] as const;

function allowed(value: string, values: readonly string[]) {
  return values.includes(value);
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session?.role !== "Admin" && session?.role !== "SuperAdmin") throw new Error("Administrator access required.");
  const admin = await prisma.user.findFirst({
    where: { id: session.userId, role: { in: ["Admin", "SuperAdmin"] }, accountStatus: "Active" },
    select: { id: true },
  });
  if (!admin) throw new Error("Administrator access required.");
  return session;
}

function text(form: FormData, key: string) { return String(form.get(key) ?? "").trim(); }
function number(form: FormData, key: string) {
  const value = Number(form.get(key));
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${key}.`);
  return value;
}
function integer(form: FormData, key: string) {
  const value = number(form, key);
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid ${key}.`);
  return value;
}
function id(form: FormData) {
  const value = integer(form, "id");
  if (value < 1) throw new Error("Invalid record identifier.");
  return value;
}

function productImage(form: FormData) {
  const value = text(form, "image");
  if (!value) return null;
  if (value.length > 255) throw new Error("The product image URL is too long.");
  if (/^[\w .()-]+\.(?:jpe?g|png|webp)$/i.test(value) || value.startsWith("/products/")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
  } catch {
    throw new Error("Enter a valid product image URL beginning with http:// or https://.");
  }
  return value;
}

async function uploadedProductImage(form: FormData, existing: string | null = null) {
  const upload = form.get("imageFile");
  if (!(upload instanceof File) || upload.size === 0) {
    return form.has("image") ? productImage(form) : existing;
  }
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(upload.type)) {
    throw new Error("Upload a JPG, PNG, or WebP product image.");
  }
  if (upload.size > 1_500_000) throw new Error("Product images must be smaller than 1.5 MB.");
  const bytes = new Uint8Array(await upload.arrayBuffer());
  const isJpeg = upload.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = upload.type === "image/png" && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  const isWebp = upload.type === "image/webp" && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) throw new Error("The uploaded file contents do not match a supported image format.");
  const encoded = Buffer.from(bytes).toString("base64");
  return `data:${upload.type};base64,${encoded}`;
}

export async function updateClientStatus(form: FormData) {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  const status = text(form, "status");
  if (!id || id === admin.userId || !allowed(status, accountStatuses)) throw new Error("Invalid client update.");
  await prisma.user.updateMany({ where: { id, role: "User" }, data: { accountStatus: status } });
  await writeAudit(prisma, { userId: admin.userId, name: admin.name, role: admin.role }, "UPDATE", "Customer Account", `Changed customer account ${id} status to ${status}.`, id, await requestIp());
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=customers&notice=Customer%20access%20updated.");
}

export async function createProduct(form: FormData) {
  const admin = await requireAdmin();
  const group = text(form, "group");
  if (!allowed(group, productGroups)) throw new Error("Invalid product group.");
  const sku = text(form,"sku").toUpperCase();
  const product = await prisma.product.create({ data: { sku:sku || null, productName:text(form,"name"), category:text(form,"category"), productGroup:group, price:number(form,"price"), stockQuantity:integer(form,"stock"), reorderLevel:integer(form,"reorder"), description:text(form,"description") || null, image:await uploadedProductImage(form), isActive:1 } });
  await writeAudit(prisma, { userId: admin.userId, name: admin.name, role: admin.role }, "CREATE", "Product", `Created product ${product.productName}.`, product.productId, await requestIp());
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=products&notice=Product%20added%20successfully.");
}

export async function updateProduct(form: FormData) {
  const admin = await requireAdmin();
  const group = text(form, "group");
  if (!allowed(group, productGroups)) throw new Error("Invalid product group.");
  const productId = id(form);
  const current = await prisma.product.findUnique({ where: { productId }, select: { image: true } });
  if (!current) throw new Error("Product not found.");
  const product = await prisma.product.update({ where:{ productId }, data:{ productName:text(form,"name"), category:text(form,"category"), productGroup:group, price:number(form,"price"), stockQuantity:integer(form,"stock"), reorderLevel:integer(form,"reorder"), description:text(form,"description") || null, image:await uploadedProductImage(form, current.image), isActive:form.get("active")==="on" ? 1 : 0 } });
  await writeAudit(prisma, { userId: admin.userId, name: admin.name, role: admin.role }, "UPDATE", "Product", `Updated product ${product.productName}, including stock and availability.`, productId, await requestIp());
  revalidatePath("/admin/dashboard");
}

export async function updatePackage(form: FormData) {
  const admin = await requireAdmin();
  const pricingId = id(form);
  await prisma.$transaction(async tx => {
    const pricing = await tx.styleSizePricing.update({ where:{pricingId}, data:{price:number(form,"price")} });
    await tx.groomingStyle.update({ where:{styleId:pricing.styleId}, data:{styleName:text(form,"name")} });
  });
  await writeAudit(prisma, { userId: admin.userId, name: admin.name, role: admin.role }, "UPDATE", "Grooming Service", "Updated a grooming package and price.", pricingId, await requestIp());
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=services&notice=Grooming%20package%20updated.");
}

export async function updateAddon(form: FormData) {
  const admin = await requireAdmin();
  const addonId = id(form);
  const addon = await prisma.groomingAddon.update({ where:{addonId}, data:{addonName:text(form,"name"),price:number(form,"price")} });
  await writeAudit(prisma, { userId: admin.userId, name: admin.name, role: admin.role }, "UPDATE", "Grooming Service", `Updated add-on ${addon.addonName}.`, addonId, await requestIp());
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=services&notice=Add-on%20service%20updated.");
}

export async function updateGroomingStatus(form: FormData) {
  const admin = await requireAdmin();
  const status = text(form,"status");
  if (!allowed(status, groomingStatuses)) throw new Error("Invalid appointment status.");
  const appointmentId = BigInt(text(form,"id"));
  const previous = await prisma.groomingAppointment.findUnique({ where: { appointmentId }, select: { status: true } });
  if (!previous) throw new Error("Appointment not found.");
  const groomingTransitions: Record<string, readonly string[]> = { Pending: ["Pending", "Confirmed", "Cancelled"], Confirmed: ["Confirmed", "Completed", "Cancelled"], Completed: ["Completed"], Cancelled: ["Cancelled"] };
  if (!groomingTransitions[previous.status]?.includes(status)) throw new Error(`A ${previous.status.toLowerCase()} appointment cannot be changed to ${status}.`);
  const appointment = await prisma.groomingAppointment.update({ where:{appointmentId}, data:{status,cancelledAt:status==="Cancelled"?new Date():null}, include:{customer:true,pet:true} });
  await writeAudit(prisma, { userId: admin.userId, name: admin.name, role: admin.role }, status === "Cancelled" ? "CANCEL" : "UPDATE", "Grooming Appointment", `Changed ${appointment.reservationCode} from ${previous.status} to ${status}.`, appointmentId, await requestIp());
  if (status === "Cancelled" && previous.status !== "Cancelled") await notifyAdministrators(prisma, { eventKey: `appointment.cancelled.${appointmentId}`, title: "Appointment cancelled", message: `${admin.name} cancelled appointment ${appointment.reservationCode}.`, type: "GROOMING_CANCELLATION", relatedType: "appointment", relatedId: appointmentId, link: `/admin/dashboard?view=reservations&q=${appointment.reservationCode}` });
  if (appointment.customer.email) {
    try {
      await sendAppointmentStatus(appointment.customer.email, { name:appointment.customer.customerName,pet:appointment.pet.petName,status,reference:appointment.reservationCode,bookingType:appointment.bookingType });
    } catch (error) {
      console.error("Appointment status saved but notification email failed", error);
    }
  }
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=reservations&notice=Reservation%20status%20updated.");
}

export async function updateProductReservationStatus(form: FormData) {
  const admin = await requireAdmin();
  const id = BigInt(text(form,"id"));
  const status = text(form,"status");
  if (!allowed(status, productReservationStatuses)) throw new Error("Invalid reservation status.");
  const ip = await requestIp();
  await prisma.$transaction(async tx => {
    const reservation = await tx.productReservation.findUnique({where:{reservationId:id},include:{items:true}});
    if (!reservation || reservation.status==="Cancelled") throw new Error("Reservation cannot be changed.");
    const orderTransitions: Record<string, readonly string[]> = { Pending: ["Pending", "Approved", "Cancelled"], Approved: ["Approved", "Ready for Pickup", "Cancelled"], "Ready for Pickup": ["Ready for Pickup", "Completed", "Cancelled"], Completed: ["Completed"] };
    if (!orderTransitions[reservation.status]?.includes(status)) throw new Error(`A ${reservation.status.toLowerCase()} reservation cannot be changed to ${status}.`);
    if (status==="Cancelled") {
      for (const item of reservation.items) await tx.product.update({where:{productId:item.productId},data:{stockQuantity:{increment:item.quantity}}});
    }
    await tx.productReservation.update({where:{reservationId:id},data:{status}});
    await writeAudit(tx, { userId: admin.userId, name: admin.name, role: admin.role }, status === "Cancelled" ? "CANCEL" : "UPDATE", "Product Reservation", `Changed ${reservation.reservationCode} from ${reservation.status} to ${status}.`, id, ip);
    if (status === "Cancelled") await notifyAdministrators(tx, { eventKey: `product-reservation.cancelled.${id}`, title: "Product reservation cancelled", message: `${admin.name} cancelled reservation ${reservation.reservationCode}.`, type: "PRODUCT_CANCELLATION", relatedType: "product_reservation", relatedId: id, link: `/admin/dashboard?view=orders&q=${reservation.reservationCode}` });
  });
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=orders&notice=Order%20status%20updated.");
}

export async function createGroomer(form: FormData) {
  const admin = await requireAdmin();
  const name = text(form, "name");
  const contactNumber = text(form, "contactNumber") || null;
  if (!name || (contactNumber && !isPhilippinePhone(contactNumber))) throw new Error("Enter a groomer name and a valid Philippine mobile number.");
  const groomer = await prisma.groomer.create({ data: { groomerName: name, contactNumber, isActive: 1 } });
  await writeAudit(prisma, { userId: admin.userId, name: admin.name, role: admin.role }, "CREATE", "Groomer", `Added groomer ${name}.`, groomer.groomerId, await requestIp());
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=groomers&notice=Groomer%20added%20successfully.");
}

export async function updateGroomer(form: FormData) {
  const admin = await requireAdmin();
  const groomerId = id(form);
  const name = text(form, "name");
  const contactNumber = text(form, "contactNumber") || null;
  if (!name || (contactNumber && !isPhilippinePhone(contactNumber))) throw new Error("Enter a groomer name and a valid Philippine mobile number.");
  const groomer = await prisma.groomer.update({ where: { groomerId }, data: { groomerName: name, contactNumber, isActive: form.get("active") === "on" ? 1 : 0 } });
  await writeAudit(prisma, { userId: admin.userId, name: admin.name, role: admin.role }, "UPDATE", "Groomer", `Updated ${groomer.groomerName} availability and contact details.`, groomerId, await requestIp());
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=groomers&notice=Groomer%20updated.");
}

export async function saveGroomerSchedule(form: FormData) {
  const admin = await requireAdmin();
  const groomerId = id(form);
  const dayOfWeek = integer(form, "dayOfWeek");
  const start = text(form, "startTime");
  const end = text(form, "endTime");
  if (dayOfWeek < 0 || dayOfWeek > 6 || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) throw new Error("Choose a valid work day and time range.");
  await prisma.groomerAvailability.upsert({ where: { groomerId_dayOfWeek: { groomerId, dayOfWeek } }, create: { groomerId, dayOfWeek, startTime: new Date(`1970-01-01T${start}:00.000Z`), endTime: new Date(`1970-01-01T${end}:00.000Z`), isActive: true }, update: { startTime: new Date(`1970-01-01T${start}:00.000Z`), endTime: new Date(`1970-01-01T${end}:00.000Z`), isActive: true } });
  await writeAudit(prisma, { userId: admin.userId, name: admin.name, role: admin.role }, "UPDATE", "Groomer Schedule", `Updated day ${dayOfWeek} schedule to ${start}-${end}.`, groomerId, await requestIp());
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=groomers&notice=Groomer%20schedule%20updated.");
}

export async function updateLoyalty(form: FormData) {
  const admin = await requireAdmin();
  const customerId = id(form);
  const stamps = integer(form, "stamps");
  const reason = text(form, "reason");
  if (stamps < 0 || stamps > 10 || reason.length < 3) throw new Error("Stamps must be between 0 and 10 and include a reason.");
  const ip = await requestIp();
  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error("Customer profile not found.");
    const change = stamps - customer.loyaltyStamps;
    await tx.customer.update({ where: { id: customerId }, data: { loyaltyStamps: stamps, rewardAvailable: stamps === 10, rewardRedeemedAt: stamps < 10 ? customer.rewardRedeemedAt : null } });
    await tx.loyaltyTransaction.create({ data: { customerId, changedById: admin.userId, changeAmount: change, balanceAfter: stamps, reason } });
    await writeAudit(tx, { userId: admin.userId, name: admin.name, role: admin.role }, "UPDATE", "Loyalty", `Changed ${customer.customerName} loyalty balance from ${customer.loyaltyStamps} to ${stamps}: ${reason}`, customerId, ip);
  });
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=customers&notice=Loyalty%20progress%20updated.");
}

export async function redeemLoyaltyReward(form: FormData) {
  const admin = await requireAdmin();
  const customerId = id(form);
  const ip = await requestIp();
  await prisma.$transaction(async (tx) => {
    const result = await tx.customer.updateMany({ where: { id: customerId, loyaltyStamps: 10, rewardAvailable: true }, data: { loyaltyStamps: 0, rewardAvailable: false, rewardRedeemedAt: new Date() } });
    if (result.count !== 1) throw new Error("This reward is not currently available.");
    await tx.loyaltyTransaction.create({ data: { customerId, changedById: admin.userId, changeAmount: -10, balanceAfter: 0, reason: "VIP / loyalty reward redeemed" } });
    await writeAudit(tx, { userId: admin.userId, name: admin.name, role: admin.role }, "REDEEM", "Loyalty", "Redeemed the customer's loyalty reward and reset stamps.", customerId, ip);
  });
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=customers&notice=Loyalty%20reward%20redeemed.");
}

export async function updateLoyaltySetting(form: FormData) {
  const admin = await requireAdmin();
  const label = text(form, "rewardLabel");
  if (label.length < 3 || label.length > 120) throw new Error("Enter a reward label between 3 and 120 characters.");
  await prisma.systemSetting.upsert({ where: { key: "loyalty_reward_label" }, create: { key: "loyalty_reward_label", value: label }, update: { value: label } });
  await writeAudit(prisma, { userId: admin.userId, name: admin.name, role: admin.role }, "UPDATE", "Settings", `Updated loyalty reward label to ${label}.`, "loyalty_reward_label", await requestIp());
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?view=settings&notice=Settings%20updated.");
}

export async function openNotification(form: FormData) {
  const admin = await requireAdmin();
  const notificationId = BigInt(text(form, "id"));
  const notification = await prisma.notification.findFirst({ where: { notificationId, recipientId: admin.userId } });
  if (!notification) throw new Error("Notification not found.");
  await prisma.notification.update({ where: { notificationId }, data: { isRead: true, readAt: new Date() } });
  revalidatePath("/admin/dashboard");
  redirect(notification.link);
}
