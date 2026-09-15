import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookieName } from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const encoded = user?.password?.startsWith("$2y$") ? "$2b$" + user.password.slice(4) : user?.password;
  const valid = user?.role === "SuperAdmin" && user.accountStatus === "Active" && encoded && await compare(password, encoded);
  if (!valid) return NextResponse.redirect(new URL("/superadmin/login?error=invalid", request.url), 303);
  const name = [user.firstName, user.surname].filter(Boolean).join(" ") || "Super Administrator";
  const response = NextResponse.redirect(new URL("/superadmin/dashboard", request.url), 303);
  response.cookies.set(sessionCookieName, await createSessionToken({ userId: user.id, role: "SuperAdmin", name }), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8, path: "/" });
  return response;
}
