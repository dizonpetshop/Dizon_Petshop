import { NextRequest, NextResponse } from "next/server";
import { readSessionToken, sessionCookieName } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const session = await readSessionToken(request.cookies.get(sessionCookieName)?.value);

  if (path.startsWith("/admin/dashboard") && session?.role !== "Admin" && session?.role !== "SuperAdmin") {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (path.startsWith("/superadmin/dashboard") && session?.role !== "SuperAdmin") {
    return NextResponse.redirect(new URL("/superadmin/login", request.url));
  }
  if (path.startsWith("/client/dashboard") && session?.role !== "User") {
    return NextResponse.redirect(new URL("/client/login", request.url));
  }
  if (path === "/admin/login" && session?.role === "Admin") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }
  if (path === "/admin/login" && session?.role === "SuperAdmin") {
    return NextResponse.redirect(new URL("/superadmin/dashboard", request.url));
  }
  if ((path === "/superadmin/login" || path === "/superadmin/setup") && session?.role === "SuperAdmin") {
    return NextResponse.redirect(new URL("/superadmin/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/superadmin/:path*", "/client/dashboard/:path*"] };
