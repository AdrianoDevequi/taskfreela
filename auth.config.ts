import type { NextAuthConfig } from "next-auth"

export default {
    providers: [],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async session({ session, token }) {
            return session;
        },
        async jwt({ token }) {
            return token;
        }
    }
} satisfies NextAuthConfig
