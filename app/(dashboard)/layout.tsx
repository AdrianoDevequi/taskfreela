
import DashboardShell from "@/components/DashboardShell";
import { auth } from "@/auth";

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();

    return (
        <DashboardShell user={session?.user}>
            {children}
        </DashboardShell>
    );
}
