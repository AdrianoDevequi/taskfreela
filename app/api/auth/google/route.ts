
import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { origin } = new URL(request.url);
    const redirectUri = `${origin}/api/auth/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
    );

    const scopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent", // Force refresh token generation
    });

    return NextResponse.redirect(url);
}
