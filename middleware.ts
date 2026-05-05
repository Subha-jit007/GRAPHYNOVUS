import { NextResponse, type NextRequest } from "next/server";
import { getMiddlewareSupabase } from "@/lib/supabase-middleware";

// Public routes — everything else inside the (dashboard) group is gated.
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

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // getSession() reads + decodes the JWT from the auth cookie locally —
  // no network round-trip to Supabase for valid (non-expired) tokens.
  // It only calls the network when the access token is expired and needs
  // refreshing via the refresh token (~once per hour).
  //
  // getUser() was replaced here because it validates the token against
  // Supabase's servers on EVERY request, adding 200-1500ms and routinely
  // exceeding Vercel's 1500ms middleware hard limit (MIDDLEWARE_INVOCATION_TIMEOUT).
  //
  // API routes and Server Components still call getUser() for authoritative
  // auth — this middleware is only responsible for routing decisions.
  const supabase = getMiddlewareSupabase(request, response);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  const { pathname, search } = request.nextUrl;

  // Signed-in users shouldn't see /login or /signup — bounce them to the app.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated users hitting any non-public route get sent to /login,
  // preserving where they were trying to go via ?next=.
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on every request except Next internals, the API surface (route
  // handlers do their own auth), and static assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
