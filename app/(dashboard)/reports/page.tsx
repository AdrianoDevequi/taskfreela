"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { ArrowUpRight, CheckCircle2, CircleDashed, ListTodo, TrendingUp } from "lucide-react";

export default function ReportsPage() {
    const [data, setData] = useState<any>(null);
    const [range, setRange] = useState("30");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/reports?range=${range}`);
                const json = await res.json();
                setData(json);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [range]);

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando dados...</div>;
    if (!data) return <div className="p-8 text-center text-destructive">Erro ao carregar relatório.</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        Relatórios e Métricas
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Acompanhe o desempenho das suas tarefas.
                    </p>
                </div>

                <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    className="bg-card border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                >
                    <option value="7">Últimos 7 dias</option>
                    <option value="15">Últimos 15 dias</option>
                    <option value="30">Últimos 30 dias</option>
                </select>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Total de Tarefas"
                    value={data.metrics.total}
                    icon={<ListTodo className="text-purple-400" />}
                    gradient="from-purple-500/10 to-transparent"
                    border="border-purple-500/20"
                />
                <KpiCard
                    title="Concluídas"
                    value={data.metrics.completed}
                    icon={<CheckCircle2 className="text-green-400" />}
                    gradient="from-green-500/10 to-transparent"
                    border="border-green-500/20"
                />
                <KpiCard
                    title="Em Progresso"
                    value={data.metrics.inProgress}
                    icon={<CircleDashed className="text-blue-400" />}
                    gradient="from-blue-500/10 to-transparent"
                    border="border-blue-500/20"
                />
                <KpiCard
                    title="Taxa de Entrega"
                    value={`${data.metrics.rate}%`}
                    icon={<TrendingUp className="text-pink-400" />}
                    gradient="from-pink-500/10 to-transparent"
                    border="border-pink-500/20"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Area Chart */}
                <div className="lg:col-span-2 bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-xl">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <ArrowUpRight size={18} className="text-primary" />
                        Produtividade no Período
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.activityData}>
                                <defs>
                                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="name" stroke="#666" tick={{ fill: '#666', fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 12 }} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: 13 }}
                                />
                                <Area type="monotone" dataKey="created" name="Criadas" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorCreated)" />
                                <Area type="monotone" dataKey="completed" name="Concluídas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bar Chart (Status) */}
                <div className="bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-xl">
                    <h3 className="text-lg font-semibold mb-6">Distribuição</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.statusDistribution} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} stroke="#888" tick={{ fill: '#888', fontSize: 12 }} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                                    {data.statusDistribution.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
}

function KpiCard({ title, value, icon, gradient, border }: any) {
    return (
        <div className={`relative overflow-hidden bg-black/40 backdrop-blur-xl border ${border} rounded-2xl p-6 group transition-all hover:-translate-y-1`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-20`} />
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">{title}</p>
                    <div className="p-2 bg-white/5 rounded-lg text-white/80 group-hover:scale-110 transition-transform">
                        {icon}
                    </div>
                </div>
                <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
            </div>
        </div>
    );
}
