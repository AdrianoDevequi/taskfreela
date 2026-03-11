import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
    try {
        const session = await auth();
        
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        return NextResponse.json({
            id: (session.user as any).id,
            email: session.user.email,
        });
    } catch (error) {
        console.error("Error fetching active user data:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
