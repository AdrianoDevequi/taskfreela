import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listChats } from "@/app/actions/whatsapp";
import { InboxClient } from "@/components/whatsapp/InboxClient";

export const dynamic = "force-dynamic";

export default async function WhatsappInboxPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const initial = await listChats({});

    return <InboxClient initialChats={initial.chats} instances={initial.instances} />;
}
