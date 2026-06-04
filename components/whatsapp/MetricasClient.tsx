"use client";

import { WhatsappTabs } from "./WhatsappTabs";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
    CartesianGrid,
} from "recharts";
import { MessageSquare, AlertCircle, CheckCheck, Timer, BarChart3 } from "lucide-react";

type Metrics = {
    instances: { id: string; label: string }[];
    totals: { chats: number; pending: number; answered: number; resolved: number };
    pendingByPriority: { priority: string; label: string; count: number }[];
    pendingByInstance: { label: string; count: number }[];
    avgResponseSeconds: number | null;
    respondedCount: number;
};

const PRIORITY_COLORS: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#6b7280" };
const AXIS = "#9ca3af";
const TOOLTIP_STYLE = {
    background: "#0b1220",
    border: "1px solid #1f2937",
    borderRadius: 8,
    fontSize: 12,
    color: "#e5e7eb",
};

function humanizeSeconds(secs: number): string {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}min`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
}

export function MetricasClient({ data }: { data: Metrics }) {
    const hasData = data.totals.chats > 0;

    return (
        <div className="max-w-5xl mx-auto py-6">
            <div className="mb-2">
                <h1 className="text-3xl font-bold mb-1">WhatsApp</h1>
                <p className="text-muted-foreground">Métricas de atendimento e tempo de resposta.</p>
            </div>
            <WhatsappTabs />

            {!hasData ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                    <BarChart3 size={40} className="mb-3 opacity-40" />
                    <p className="mb-3">Sem dados ainda. Sincronize uma instância para ver as métricas.</p>
                    <a href="/whatsapp/conexoes" className="text-primary font-semibold hover:underline">
                        Ir para Conexões →
                    </a>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Stat icon={MessageSquare} label="Conversas" value={data.totals.chats} />
                        <Stat icon={AlertCircle} label="Sem resposta" value={data.totals.pending} accent="red" />
                        <Stat icon={CheckCheck} label="Respondidas" value={data.totals.answered} accent="green" />
                        <Stat
                            icon={Timer}
                            label="Tempo médio de resposta"
                            value={data.avgResponseSeconds != null ? humanizeSeconds(Math.round(data.avgResponseSeconds)) : "—"}
                            sub={`${data.respondedCount} resposta(s) medida(s)`}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                        <ChartCard title="Sem resposta por prioridade">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.pendingByPriority} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} axisLine={{ stroke: "#1f2937" }} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                    <Bar dataKey="count" name="Sem resposta" radius={[6, 6, 0, 0]}>
                                        {data.pendingByPriority.map((p) => (
                                            <Cell key={p.priority} fill={PRIORITY_COLORS[p.priority] || "#6b7280"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title="Sem resposta por conta">
                            {data.pendingByInstance.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                                    Nenhuma pendência. 🎉
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.pendingByInstance} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} axisLine={{ stroke: "#1f2937" }} tickLine={false} />
                                        <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                        <Bar dataKey="count" name="Sem resposta" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    </div>

                    <p className="text-xs text-muted-foreground mt-4">
                        O tempo médio considera as conversas em que houve resposta após uma mensagem recebida. Sincronize
                        as instâncias para manter os números atualizados.
                    </p>
                </>
            )}
        </div>
    );
}

function Stat({
    icon: Icon,
    label,
    value,
    sub,
    accent,
}: {
    icon: any;
    label: string;
    value: string | number;
    sub?: string;
    accent?: "red" | "green";
}) {
    const accentCls =
        accent === "red"
            ? "text-red-400 bg-red-500/10"
            : accent === "green"
            ? "text-green-500 bg-green-500/10"
            : "text-primary bg-primary/10";
    return (
        <div className="bg-card border border-border rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${accentCls}`}>
                <Icon size={18} />
            </div>
            <div className="text-2xl font-bold leading-tight">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
            {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">{title}</h3>
            <div style={{ width: "100%", height: 240 }}>{children}</div>
        </div>
    );
}
