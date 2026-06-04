"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Plug, BarChart3 } from "lucide-react";

const TABS = [
    { href: "/whatsapp", label: "Inbox", icon: Inbox },
    { href: "/whatsapp/metricas", label: "Métricas", icon: BarChart3 },
    { href: "/whatsapp/conexoes", label: "Conexões", icon: Plug },
];

export function WhatsappTabs() {
    const pathname = usePathname();
    return (
        <div className="flex items-center gap-1 border-b border-border mb-6">
            {TABS.map((tab) => {
                const active = pathname === tab.href;
                const Icon = tab.icon;
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            active
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Icon size={16} />
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
