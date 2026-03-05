import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { pathname } = req.nextUrl;
    console.log(`Middleware: ${pathname} | LoggedIn: ${isLoggedIn}`);

    const isOnDashboard = pathname.startsWith('/agenda') ||
        pathname.startsWith('/dashboard') ||
        pathname === '/' ||
        pathname.startsWith('/lembretes') ||
        pathname.startsWith('/reports');
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');

    if (isOnDashboard) {
        if (isLoggedIn) return;
        console.log(`Redirecting unauthenticated user from ${pathname} to /login`);
        return Response.redirect(new URL('/login', req.nextUrl));
    }

    if (isAuthRoute) {
        if (isLoggedIn) {
            console.log(`Redirecting authenticated user from ${pathname} to /`);
            return Response.redirect(new URL('/', req.nextUrl));
        }
        return;
    }
});

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
