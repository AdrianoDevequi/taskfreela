import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const subscription = await req.json();

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
        }

        // Save the subscription to the database
        await (prisma as any).pushSubscription.upsert({
            where: {
                endpoint: subscription.endpoint,
            },
            create: {
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                userId: session.user.id,
            },
            update: {
                userId: session.user.id, // Ensure it's linked to the latest logged-in user if devices are shared
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving push subscription:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
