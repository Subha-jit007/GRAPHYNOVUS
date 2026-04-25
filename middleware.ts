import { NextResponse, type NextRequest } from "next/server";
import { getMiddlewareSupabase } from "@/lib/supabase";

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

  // Touching getUser() refreshes the session cookies on the response, even
  // when we end up redirecting below.
  const supabase = getMiddlewareSupabase(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
