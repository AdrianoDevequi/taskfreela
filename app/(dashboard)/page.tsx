import { redirect } from "next/navigation";

// (dashboard)/page.tsx → /
// The layout already guards auth (redirects to /login if no session).
// If logged in, go straight to /dashboard.
export default function DashboardRootRedirect() {
    redirect("/dashboard");
}
