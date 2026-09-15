import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookieName } from "@/lib/session";

export async function POST(request: Request) {
  const existing = await prisma.user.count({ where: { role: "SuperAdmin" } });
  if (existing) return NextResponse.redirect(new URL("/superadmin/login?error=setup-closed", request.url), 303);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const admin = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, role: "Admin", accountStatus: "Active" } });
  const encoded = admin?.password?.startsWith("$2y$") ? "$2b$" + admin.password.slice(4) : admin?.password;
  if (!admin || !encoded || !await compare(password, encoded)) return NextResponse.redirect(new URL("/superadmin/setup?error=invalid", request.url), 303);
  await prisma.user.update({ where: { id: admin.id }, data: { role: "SuperAdmin" } });
  const name = [admin.firstName, admin.surname].filter(Boolean).join(" ") || "Super Administrator";
  const response = NextResponse.redirect(new URL("/superadmin/dashboard", request.url), 303);
  response.cookies.set(sessionCookieName, await createSessionToken({ userId: admin.id, role: "SuperAdmin", name }), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8, path: "/" });
  return response;
}
