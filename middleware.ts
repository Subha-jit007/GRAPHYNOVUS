import { NextResponse, type NextRequest } from "next/server";

// Public routes — everything else requires an auth session.
const PUBLIC_PREFIXES = ["/login", "/signup", "/auth/callback"];
const PUBLIC_EXACT = ["/"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  );
}

// Zero-network session check — reads the Supabase auth cookie from the
// request directly. @supabase/ssr stores the session as JSON in a cookie
// named "sb-<project-ref>-auth-token" (sometimes chunked as .0, .1, …).
//
// WHY not supabase.auth.getUser() or getSession():
//   Both require initialising the GoTrueClient and can make a network call
//   to Supabase Auth servers. Vercel's Edge middleware hard limit is 1500ms
//   including all I/O. Any external request risks MIDDLEWARE_INVOCATION_TIMEOUT.
//
// SECURITY: this only gates routing (redirect to /login or not). Every API
// route and Server Component calls getUser() for authoritative validation.
function hasSupabaseSession(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.includes("-auth-token") && c.value.length > 0);
}

// Synchronous — no async, no await, no I/O.
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = hasSupabaseSession(request);

  // Signed-in users hitting /login or /signup → redirect into the app.
  if (hasSession && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated users hitting any protected route → /login?next=...
  if (!hasSession && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
