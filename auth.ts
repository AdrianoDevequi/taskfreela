import NextAuth from "next-auth"
import { prisma } from "./lib/prisma"
import authConfig from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import bcrypt from "bcryptjs"

export const { auth, handlers, signIn, signOut } = NextAuth({
    session: { strategy: "jwt" },
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await prisma.user.findUnique({ 
                        where: { email },
                        include: { workspaceMembers: true }
                    });
                    if (!user || !user.password) return null;
                    const passwordsMatch = await bcrypt.compare(password, user.password);

                    if (passwordsMatch) {
                        const activeMember = user.workspaceMembers.find(m => m.workspaceId === user.activeWorkspaceId);
                        return {
                            ...user,
                            role: activeMember?.role || "EMPLOYEE",
                            workspaceId: user.activeWorkspaceId,
                            isSuperAdmin: (user as any).isSuperAdmin,
                        };
                    }
                }

                console.log("Invalid credentials");
                return null;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.workspaceId = (user as any).workspaceId;
                token.isSuperAdmin = (user as any).isSuperAdmin;
            }

            if (trigger === "update" && session?.activeWorkspaceId) {
                token.workspaceId = session.activeWorkspaceId;
            }

            return token;
        },
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
                (session.user as any).role = token.role;
                (session.user as any).workspaceId = token.workspaceId;
                (session.user as any).whatsapp = token.whatsapp;
                (session.user as any).isSuperAdmin = token.isSuperAdmin;
            }
            return session;
        },
    },
})
