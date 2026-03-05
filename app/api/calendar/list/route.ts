import { google } from "googleapis";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const integrations = await prisma.integration.findMany({
            where: {
                provider: "GOOGLE",
                userId: session.user.id
            }
        });

        if (!integrations || integrations.length === 0) {
            return NextResponse.json({ error: "No calendar connected" }, { status: 404 });
        }

        let allCalendars: any[] = [];

        await Promise.all(integrations.map(async (integration) => {
            try {
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET,
                    process.env.GOOGLE_REDIRECT_URI
                );

                oauth2Client.setCredentials({
                    access_token: integration.accessToken,
                    refresh_token: integration.refreshToken,
                });

                const calendar = google.calendar({ version: "v3", auth: oauth2Client });
                const response = await calendar.calendarList.list();

                // Attach integrationId and accountEmail to each calendar
                const items = response.data.items?.map(cal => ({
                    ...cal,
                    integrationId: integration.id,
                    accountEmail: integration.accountEmail
                })) || [];

                allCalendars = [...allCalendars, ...items];
            } catch (err) {
                console.error(`Failed to fetch calendars for integration ${integration.id}:`, err);
            }
        }));

        return NextResponse.json({
            calendars: allCalendars
        });

    } catch (error) {
        console.error("Calendar List API Error:", error);
        return NextResponse.json({ error: "Failed to fetch calendars" }, { status: 500 });
    }
}
