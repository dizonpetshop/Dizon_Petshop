import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { databaseConfigurationError, logDatabaseFailure } from "@/lib/database";
import { isPhilippinePhone } from "@/lib/operations";

export async function POST(request: Request) {
  const form = await request.formData();
  const firstName = String(form.get("firstName") ?? "").trim();
  const surname = String(form.get("surname") ?? "").trim();
  const middleInitial = String(form.get("middleInitial") ?? "").trim().slice(0,2) || null;
  const phoneNumber = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!firstName || !surname || !isPhilippinePhone(phoneNumber) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return NextResponse.redirect(new URL("/client/register?error=invalid",request.url),303);
  if (databaseConfigurationError()) return NextResponse.redirect(new URL("/client/register?error=database-config", request.url), 303);
  try {
    const existingUser = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existingUser) return NextResponse.redirect(new URL("/client/register?error=exists",request.url),303);
    await prisma.user.create({data:{role:"User",accountStatus:"Active",firstName,surname,middleInitial,phoneNumber,email,password:await hash(password,12)}});
    return NextResponse.redirect(new URL("/client/login?registered=1",request.url),303);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.redirect(new URL("/client/register?error=exists", request.url), 303);
    }
    logDatabaseFailure("Client registration", error);
    return NextResponse.redirect(new URL("/client/register?error=unavailable", request.url), 303);
  }
}
