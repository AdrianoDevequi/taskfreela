import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getWhatsappMetrics } from "@/app/actions/whatsapp";
import { MetricasClient } from "@/components/whatsapp/MetricasClient";

export const dynamic = "force-dynamic";

export default async function MetricasPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const data = await getWhatsappMetrics();

    return <MetricasClient data={data} />;
}
