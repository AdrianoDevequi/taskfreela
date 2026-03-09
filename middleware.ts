import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    // Check both standard and secure (production) NextAuth session cookies
    const sessionToken = req.cookies.get("authjs.session-token") || req.cookies.get("__Secure-authjs.session-token");
    const isLoggedIn = !!sessionToken;
    const { pathname } = req.nextUrl;
    
    console.log(`Middleware: ${pathname} | LoggedIn: ${isLoggedIn}`);

    const isOnDashboard = pathname.startsWith('/agenda') ||
        pathname.startsWith('/dashboard') ||
        pathname === '/' ||
        pathname.startsWith('/lembretes') ||
        pathname.startsWith('/reports');
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');

    if (isOnDashboard) {
        if (isLoggedIn) return NextResponse.next();
        console.log(`Redirecting unauthenticated user from ${pathname} to /login`);
        return NextResponse.redirect(new URL('/login', req.nextUrl));
    }

    if (isAuthRoute) {
        if (isLoggedIn) {
            console.log(`Redirecting authenticated user from ${pathname} to /`);
            return NextResponse.redirect(new URL('/', req.nextUrl));
        }
        return NextResponse.next();
    }
    
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
