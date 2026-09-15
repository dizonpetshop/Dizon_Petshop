"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/session";
import { sendAppointmentStatus } from "@/lib/mail";

const accountStatuses = ["Active", "Suspended"] as const;
const productGroups = ["Food", "Shampoo", "Other"] as const;
const groomingStatuses = ["Pending", "Confirmed", "Completed", "Cancelled"] as const;
const productReservationStatuses = ["Pending", "Confirmed", "Ready for Pickup", "Claimed", "Cancelled"] as const;

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
  const encoded = Buffer.from(await upload.arrayBuffer()).toString("base64");
  return `data:${upload.type};base64,${encoded}`;
}

export async function updateClientStatus(form: FormData) {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  const status = text(form, "status");
  if (!id || id === admin.userId || !allowed(status, accountStatuses)) throw new Error("Invalid client update.");
  await prisma.user.updateMany({ where: { id, role: { not: "Admin" } }, data: { accountStatus: status } });
  revalidatePath("/admin/dashboard");
}

export async function createProduct(form: FormData) {
  await requireAdmin();
  const group = text(form, "group");
  if (!allowed(group, productGroups)) throw new Error("Invalid product group.");
  const sku = text(form,"sku").toUpperCase();
  await prisma.product.create({ data: { sku:sku || null, productName:text(form,"name"), category:text(form,"category"), productGroup:group, price:number(form,"price"), stockQuantity:integer(form,"stock"), reorderLevel:integer(form,"reorder"), description:text(form,"description") || null, image:await uploadedProductImage(form), isActive:true } });
  revalidatePath("/admin/dashboard");
}

export async function updateProduct(form: FormData) {
  await requireAdmin();
  const group = text(form, "group");
  if (!allowed(group, productGroups)) throw new Error("Invalid product group.");
  const productId = id(form);
  const current = await prisma.product.findUnique({ where: { productId }, select: { image: true } });
  if (!current) throw new Error("Product not found.");
  await prisma.product.update({ where:{ productId }, data:{ productName:text(form,"name"), category:text(form,"category"), productGroup:group, price:number(form,"price"), stockQuantity:integer(form,"stock"), reorderLevel:integer(form,"reorder"), description:text(form,"description") || null, image:await uploadedProductImage(form, current.image), isActive:form.get("active")==="on" } });
  revalidatePath("/admin/dashboard");
}

export async function updatePackage(form: FormData) {
  await requireAdmin();
  const pricingId = id(form);
  await prisma.$transaction(async tx => {
    const pricing = await tx.styleSizePricing.update({ where:{pricingId}, data:{price:number(form,"price")} });
    await tx.groomingStyle.update({ where:{styleId:pricing.styleId}, data:{styleName:text(form,"name")} });
  });
  revalidatePath("/admin/dashboard");
}

export async function updateAddon(form: FormData) {
  await requireAdmin();
  await prisma.groomingAddon.update({ where:{addonId:id(form)}, data:{addonName:text(form,"name"),price:number(form,"price")} });
  revalidatePath("/admin/dashboard");
}

export async function updateGroomingStatus(form: FormData) {
  await requireAdmin();
  const status = text(form,"status");
  if (!allowed(status, groomingStatuses)) throw new Error("Invalid appointment status.");
  const appointment = await prisma.groomingAppointment.update({ where:{appointmentId:BigInt(text(form,"id"))}, data:{status,cancelledAt:status==="Cancelled"?new Date():null}, include:{customer:true,pet:true} });
  if (appointment.customer.email) {
    try {
      await sendAppointmentStatus(appointment.customer.email, { name:appointment.customer.customerName,pet:appointment.pet.petName,status,reference:appointment.reservationCode,bookingType:appointment.bookingType });
    } catch (error) {
      console.error("Appointment status saved but notification email failed", error);
    }
  }
  revalidatePath("/admin/dashboard");
}

export async function updateProductReservationStatus(form: FormData) {
  await requireAdmin();
  const id = BigInt(text(form,"id"));
  const status = text(form,"status");
  if (!allowed(status, productReservationStatuses)) throw new Error("Invalid reservation status.");
  await prisma.$transaction(async tx => {
    const reservation = await tx.productReservation.findUnique({where:{reservationId:id},include:{items:true}});
    if (!reservation || reservation.status==="Cancelled") throw new Error("Reservation cannot be changed.");
    if (status==="Cancelled") {
      for (const item of reservation.items) await tx.product.update({where:{productId:item.productId},data:{stockQuantity:{increment:item.quantity}}});
    }
    await tx.productReservation.update({where:{reservationId:id},data:{status}});
  });
  revalidatePath("/admin/dashboard");
}
