
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const redirectUri = `${origin}/api/auth/google/callback`;

    if (!code) {
        return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
        );

        const { tokens } = await oauth2Client.getToken(code);

        // Save to DB (Single User - upsert or create)
        // We'll treat this as a single global integration for now
        tokens.access_token && oauth2Client.setCredentials(tokens);

        // Fetch user info to get email
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const userEmail = userInfo.data.email;

        if (!userEmail) {
            throw new Error("Could not retrieve user email");
        }

        // Upsert integration based on email if we want to update tokens for existing connection
        // But Prisma 'create' is fine if we just want to append. However, let's try to find existing first to update.
        // Also ensure it is linked to the current user
        const existing = await prisma.integration.findFirst({
            where: { accountEmail: userEmail, provider: "GOOGLE", userId: session.user.id }
        });

        if (existing) {
            await prisma.integration.update({
                where: { id: existing.id },
                data: {
                    accessToken: tokens.access_token!,
                    refreshToken: tokens.refresh_token || existing.refreshToken, // refresh_token might not be returned on subsequent flows unless prompt=consent
                    expiresAt: tokens.expiry_date ? BigInt(tokens.expiry_date) : undefined,
                }
            });
        } else {
            await prisma.integration.create({
                data: {
                    provider: "GOOGLE",
                    accessToken: tokens.access_token!,
                    refreshToken: tokens.refresh_token,
                    expiresAt: tokens.expiry_date ? BigInt(tokens.expiry_date) : null,
                    accountEmail: userEmail,
                    userId: session.user.id
                },
            });
        }

        return NextResponse.redirect(new URL("/", request.url));
    } catch (error) {
        console.error("Auth Error:", error);
        return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }
}
