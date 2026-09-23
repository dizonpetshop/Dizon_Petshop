import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookieName } from "@/lib/session";
import { requestIp, writeAuditSafely } from "@/lib/operations";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  // MySQL's common collations compare email addresses case-insensitively, while
  // PostgreSQL text/varchar comparisons are case-sensitive by default.
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  const hash = user?.password?.startsWith("$2y$") ? "$2b$" + user.password.slice(4) : user?.password;
  const valid = user && user.role === "User" && user.accountStatus === "Active" && hash && await compare(password, hash);
  if (!valid) return NextResponse.redirect(new URL("/client/login?error=invalid", request.url), 303);

  const name = [user.firstName, user.surname].filter(Boolean).join(" ") || "Client";
  const token = await createSessionToken({ userId: user.id, role: "User", name });
  await writeAuditSafely(prisma, { userId: user.id, name, role: "Customer" }, "LOGIN", "Authentication", "Customer signed in successfully.", user.id, await requestIp());
  const response = NextResponse.redirect(new URL("/client/dashboard", request.url), 303);
  response.cookies.set(sessionCookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8, path: "/" });
  return response;
}
