"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Timer, ListTodo, ChevronRight } from "lucide-react";
import { getSlaSummary } from "@/app/actions/whatsapp";

type Summary = {
    hasInstances: boolean;
    pending: number;
    pendingHigh: number;
    oldestSeconds: number | null;
    oldestName: string | null;
    openTasks: number;
};

function humanize(secs: number): string {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}min`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
}

export function SlaWidget() {
    const [data, setData] = useState<Summary | null>(null);

    useEffect(() => {
        let active = true;
        const load = () =>
            getSlaSummary()
                .then((d) => active && setData(d as Summary))
                .catch(() => {});
        load();
        const id = setInterval(load, 30000);
        return () => {
            active = false;
            clearInterval(id);
        };
    }, []);

    if (!data || !data.hasInstances || data.pendingHigh === 0) return null;

    return (
        <Link
            href="/whatsapp"
            className="group flex items-center gap-4 mb-6 p-4 rounded-2xl border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/50 transition-colors"
        >
            <div className="w-10 h-10 rounded-xl bg-green-500/15 text-green-500 flex items-center justify-center shrink-0">
                <AlertCircle size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">
                    WhatsApp · {data.pendingHigh} contato{data.pendingHigh > 1 ? "s" : ""} sem resposta
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {data.oldestSeconds != null && (
                        <span className="flex items-center gap-1">
                            <Timer size={12} /> mais antigo há {humanize(data.oldestSeconds)}
                            {data.oldestName ? ` (${data.oldestName})` : ""}
                        </span>
                    )}
                    {data.openTasks > 0 && (
                        <span className="flex items-center gap-1">
                            <ListTodo size={12} /> {data.openTasks} tarefa{data.openTasks > 1 ? "s" : ""} de resposta
                        </span>
                    )}
                    {data.pending > data.pendingHigh && <span>· {data.pending} no total</span>}
                </div>
            </div>
            <span className="text-xs font-semibold text-green-500 flex items-center gap-1 shrink-0">
                Responder <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
        </Link>
    );
}
