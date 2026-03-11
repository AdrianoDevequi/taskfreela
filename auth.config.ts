import type { NextAuthConfig } from "next-auth"

export default {
    providers: [],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async session({ session, token }) {
            if (session?.user && token) {
                session.user.id = (token.sub as string) || (token.id as string) || "";
                session.user.email = (token.email as string) || session.user.email || "";
            }
            return session;
        },
        async jwt({ token }) {
            return token;
        }
    }
} satisfies NextAuthConfig
