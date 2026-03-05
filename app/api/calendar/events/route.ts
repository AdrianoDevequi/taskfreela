
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const calendarIdsParam = searchParams.get('calendarIds');

        if (!calendarIdsParam) {
            return NextResponse.json({ events: [], connected: true });
        }

        const compositeIds = calendarIdsParam.split(',');

        // ... existing grouping logic ...
        // Group calendars by integration ID
        // Format of id: "integrationId:calendarId"
        const calendarsByIntegration: Record<string, string[]> = {};

        compositeIds.forEach(cid => {
            const parts = cid.split(':');
            if (parts.length >= 2) {
                const integrationId = parts[0];
                const calendarId = parts.slice(1).join(':');

                if (!calendarsByIntegration[integrationId]) {
                    calendarsByIntegration[integrationId] = [];
                }
                calendarsByIntegration[integrationId].push(calendarId);
            }
        });

        const integrationIds = Object.keys(calendarsByIntegration);

        if (integrationIds.length === 0) {
            return NextResponse.json({ events: [], connected: true });
        }

        // Fetch needed integrations (FILTERED BY USER)
        const integrations = await prisma.integration.findMany({
            where: {
                id: { in: integrationIds },
                provider: "GOOGLE",
                userId: session.user.id
            }
        });

        const integrationMap = new Map(integrations.map(i => [i.id, i]));
        let allEvents: any[] = [];

        // Fetch events for each integration in parallel
        await Promise.all(integrationIds.map(async (intId) => {
            const integration = integrationMap.get(intId);
            if (!integration) return;

            const calendarIdsToFetch = calendarsByIntegration[intId];

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

                const calendarService = google.calendar({ version: "v3", auth: oauth2Client });

                // Fetch events for each calendar of this integration
                const integrationEvents = await Promise.all(calendarIdsToFetch.map(async (calId) => {
                    try {
                        const response = await calendarService.events.list({
                            calendarId: calId,
                            timeMin: new Date().toISOString(),
                            timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                            singleEvents: true,
                            orderBy: "startTime",
                        });

                        // Add metadata
                        return (response.data.items || []).map(event => ({
                            ...event,
                            calendarId: `${intId}:${calId}`, // Return composite ID
                            accountEmail: integration.accountEmail
                        }));
                    } catch (err) {
                        console.error(`Failed to fetch events for calendar ${calId} (Integration ${intId}):`, err);
                        return [];
                    }
                }));

                allEvents = [...allEvents, ...integrationEvents.flat()];

            } catch (err) {
                console.error(`Integration ${intId} error:`, err);
            }
        }));

        // Sort by start time
        allEvents.sort((a, b) => {
            const dateA = new Date(a.start?.dateTime || a.start?.date || 0).getTime();
            const dateB = new Date(b.start?.dateTime || b.start?.date || 0).getTime();
            return dateA - dateB;
        });

        return NextResponse.json({
            connected: true,
            events: allEvents
        });

    } catch (error) {
        console.error("Events API Error:", error);
        return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }
}
