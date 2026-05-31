import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MAINTENANCE = process.env.MAINTENANCE_MODE === "true";

const MAINTENANCE_BYPASS = [
  "/maintenance",
  "/admin",
  "/login",
  "/auth",
  "/_next",
  "/images",
  "/favicon",
  "/api",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Mode maintenance ──────────────────────────────────────────────────────
  if (MAINTENANCE) {
    const bypassed = MAINTENANCE_BYPASS.some((route) =>
      pathname.startsWith(route),
    );
    if (!bypassed) {
      return NextResponse.rewrite(new URL("/maintenance", request.url));
    }
  }

  // ── Chemin rapide : routes publiques ──────────────────────────────────────
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // ── Protection auth (admin / dashboard) ──────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "user";
  const isPrivileged = ["admin", "moderator"].includes(role);

  // /admin — réservé aux admins et modérateurs
  if (pathname.startsWith("/admin") && !isPrivileged) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // /dashboard — les admins sont redirigés vers /admin
  if (pathname.startsWith("/dashboard") && role === "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
