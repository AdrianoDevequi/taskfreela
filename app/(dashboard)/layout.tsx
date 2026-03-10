import DashboardShell from "@/components/DashboardShell";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SimpleModeProvider } from "@/app/context/SimpleModeContext";
import { TeamTasksProvider } from "@/app/context/TeamTasksContext";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login");
    }

    const userObj = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { showTeamTasks: true }
    });

    const initialShowTeamTasks = userObj?.showTeamTasks ?? false;

    return (
        <SimpleModeProvider>
            <TeamTasksProvider initialShowTeamTasks={initialShowTeamTasks}>
                <DashboardShell user={session.user}>
                    {children}
                </DashboardShell>
            </TeamTasksProvider>
        </SimpleModeProvider>
    );
}
