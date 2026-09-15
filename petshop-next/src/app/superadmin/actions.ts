"use server";

import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/session";

const roles = ["User", "Admin", "SuperAdmin"] as const;
const statuses = ["Active", "Suspended"] as const;

function value(form: FormData, key: string) { return String(form.get(key) ?? "").trim(); }

async function requireSuperAdmin() {
  const session = await readSessionToken((await cookies()).get(sessionCookieName)?.value);
  if (session?.role !== "SuperAdmin") throw new Error("Super administrator access required.");
  const account = await prisma.user.findFirst({ where: { id: session.userId, role: "SuperAdmin", accountStatus: "Active" }, select: { id: true } });
  if (!account) throw new Error("Super administrator access required.");
  return account;
}

export async function createManagedAccount(form: FormData) {
  await requireSuperAdmin();
  const firstName = value(form, "firstName");
  const surname = value(form, "surname");
  const email = value(form, "email").toLowerCase();
  const phoneNumber = value(form, "phone") || null;
  const password = value(form, "password");
  const role = value(form, "role");
  if (!firstName || !surname || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !roles.includes(role as (typeof roles)[number])) throw new Error("Complete the account details correctly. Passwords require at least 8 characters.");
  await prisma.user.create({ data: { firstName, surname, email, phoneNumber, password: await hash(password, 12), role, accountStatus: "Active" } });
  revalidatePath("/superadmin/dashboard");
}

export async function updateManagedAccount(form: FormData) {
  const superAdmin = await requireSuperAdmin();
  const id = Number(value(form, "id"));
  const role = value(form, "role");
  const accountStatus = value(form, "status");
  if (!Number.isSafeInteger(id) || id < 1 || id === superAdmin.id || !roles.includes(role as (typeof roles)[number]) || !statuses.includes(accountStatus as (typeof statuses)[number])) throw new Error("Invalid account update. You cannot change your own access here.");
  await prisma.user.update({ where: { id }, data: { role, accountStatus } });
  revalidatePath("/superadmin/dashboard");
}
