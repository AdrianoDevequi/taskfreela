import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listServers } from "@/app/actions/whatsapp";
import { ConexoesClient } from "@/components/whatsapp/ConexoesClient";

export const dynamic = "force-dynamic";

export default async function ConexoesPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const servers = await listServers();

    return <ConexoesClient servers={servers} />;
}
