
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const { title, description, start, end, integrationId, calendarId } = await request.json();

        let integration;
        if (integrationId) {
            integration = await prisma.integration.findUnique({
                where: { id: integrationId }
            });
        } else {
            // Fallback to legacy behavior
            integration = await prisma.integration.findFirst({
                where: { provider: "GOOGLE" },
                orderBy: { createdAt: 'desc' }
            });
        }

        if (!integration) {
            return NextResponse.json({ error: "No calendar connected" }, { status: 401 });
        }

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

        const event = {
            summary: title,
            description: description,
            start: {
                dateTime: new Date(start).toISOString(), // e.g. "2024-01-01T10:00:00Z"
            },
            end: {
                dateTime: new Date(end).toISOString(),
            },
        };

        const response = await calendar.events.insert({
            calendarId: calendarId || "primary",
            requestBody: event,
        });

        return NextResponse.json(response.data);

    } catch (error) {
        console.error("Create Event Error:", error);
        return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }
}
