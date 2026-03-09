import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./lib/prisma"
import authConfig from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import bcrypt from "bcryptjs"

export const { auth, handlers, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
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
                            workspaceId: user.activeWorkspaceId
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
            }

            if (trigger === "update" && session?.activeWorkspaceId) {
                token.workspaceId = session.activeWorkspaceId;
            }

            // Refresh role and workspaceId from DB on every token refresh
            if (token.sub) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.sub },
                    include: { workspaceMembers: true }
                });
                if (dbUser) {
                    token.workspaceId = dbUser.activeWorkspaceId ?? null;
                    const activeMember = dbUser.workspaceMembers.find(m => m.workspaceId === dbUser.activeWorkspaceId);
                    token.role = activeMember ? activeMember.role : "EMPLOYEE";
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
                (session.user as any).role = token.role;
                (session.user as any).workspaceId = token.workspaceId;
            }
            return session;
        },
    },
})
