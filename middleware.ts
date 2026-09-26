import { NextRequest, NextResponse } from "next/server";
import { getExpectedSessionToken, timingSafeEqual } from "@/lib/auth-token";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin/real/login")) {
    return NextResponse.next();
  }

  const expectedToken = await getExpectedSessionToken();

  // Fail closed: if ADMIN_PASSWORD / ADMIN_SESSION_SECRET aren't set,
  // deny access instead of letting everyone in.
  if (!expectedToken) {
    return NextResponse.redirect(new URL("/admin/real/login", request.url));
  }

  const cookie = request.cookies.get("admin_session")?.value;

  if (!cookie || !(await timingSafeEqual(cookie, expectedToken))) {
    return NextResponse.redirect(new URL("/admin/real/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/real/:path*"],
};
