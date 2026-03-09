
import DashboardShell from "@/components/DashboardShell";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    return (
        <DashboardShell user={session.user}>
            {children}
        </DashboardShell>
    );
}
