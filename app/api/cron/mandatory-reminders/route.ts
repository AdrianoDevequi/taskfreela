import { NextResponse } from "next/server";
import { checkMandatoryTasks } from "@/services/scheduler";

export async function GET() {
    try {
        const result = await checkMandatoryTasks();
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
