import { auth } from "@/auth";
import { EvolutionSettingsForm } from "@/components/forms/EvolutionSettingsForm";
import { NotificationSettingsForm } from "@/components/forms/NotificationSettingsForm";
import { getSettings } from "@/app/actions/settings";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login");
    }

    const [settings, userObj] = await Promise.all([
        getSettings(),
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                notifyDailySummary: true,
                notifyNewTasks: true,
                notifyOverdueTasks: true,
            }
        })
    ]);

    if (!userObj) {
        redirect("/login");
    }

    return (
        <div className="max-w-4xl mx-auto py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Configurações</h1>
                <p className="text-muted-foreground">Gerencie as integrações e preferências do sistema.</p>
            </div>

            <EvolutionSettingsForm settings={settings} />
            <NotificationSettingsForm user={userObj} />
        </div>
    );
}
