"use server";

import { AccountStatus, GroomingStatus, ProductGroup, ProductReservationStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/session";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session?.role !== "Admin") throw new Error("Administrator access required.");
  const admin = await prisma.user.findFirst({
    where: { id: session.userId, role: "Admin", accountStatus: AccountStatus.Active },
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

export async function updateClientStatus(form: FormData) {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  const status = text(form, "status") as AccountStatus;
  if (!id || id === admin.userId || !Object.values(AccountStatus).includes(status)) throw new Error("Invalid client update.");
  await prisma.user.updateMany({ where: { id, role: { not: "Admin" } }, data: { accountStatus: status } });
  revalidatePath("/admin/dashboard");
}

export async function createProduct(form: FormData) {
  await requireAdmin();
  const group = text(form, "group") as ProductGroup;
  if (!Object.values(ProductGroup).includes(group)) throw new Error("Invalid product group.");
  const sku = text(form,"sku").toUpperCase();
  await prisma.product.create({ data: { sku:sku || null, productName:text(form,"name"), category:text(form,"category"), productGroup:group, price:number(form,"price"), stockQuantity:integer(form,"stock"), reorderLevel:integer(form,"reorder"), description:text(form,"description") || null, isActive:true } });
  revalidatePath("/admin/dashboard");
}

export async function updateProduct(form: FormData) {
  await requireAdmin();
  const group = text(form, "group") as ProductGroup;
  if (!Object.values(ProductGroup).includes(group)) throw new Error("Invalid product group.");
  await prisma.product.update({ where:{ productId:id(form) }, data:{ productName:text(form,"name"), category:text(form,"category"), productGroup:group, price:number(form,"price"), stockQuantity:integer(form,"stock"), reorderLevel:integer(form,"reorder"), isActive:form.get("active")==="on" } });
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
  const status = text(form,"status") as GroomingStatus;
  if (!Object.values(GroomingStatus).includes(status)) throw new Error("Invalid appointment status.");
  await prisma.groomingAppointment.update({ where:{appointmentId:BigInt(text(form,"id"))}, data:{status,cancelledAt:status===GroomingStatus.Cancelled?new Date():null} });
  revalidatePath("/admin/dashboard");
}

export async function updateProductReservationStatus(form: FormData) {
  await requireAdmin();
  const id = BigInt(text(form,"id"));
  const status = text(form,"status") as ProductReservationStatus;
  if (!Object.values(ProductReservationStatus).includes(status)) throw new Error("Invalid reservation status.");
  await prisma.$transaction(async tx => {
    const reservation = await tx.productReservation.findUnique({where:{reservationId:id},include:{items:true}});
    if (!reservation || reservation.status===ProductReservationStatus.Cancelled) throw new Error("Reservation cannot be changed.");
    if (status===ProductReservationStatus.Cancelled) {
      for (const item of reservation.items) await tx.product.update({where:{productId:item.productId},data:{stockQuantity:{increment:item.quantity}}});
    }
    await tx.productReservation.update({where:{reservationId:id},data:{status}});
  });
  revalidatePath("/admin/dashboard");
}
