import { auth } from "@/auth";
import { EvolutionSettingsForm } from "@/components/forms/EvolutionSettingsForm";
import { getSettings } from "@/app/actions/settings";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const settings = await getSettings();

    return (
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold mb-2">Configurações</h1>
            <p className="text-muted-foreground mb-8">Gerencie as integrações do sistema.</p>

            <EvolutionSettingsForm settings={settings} />
        </div>
    );
}
