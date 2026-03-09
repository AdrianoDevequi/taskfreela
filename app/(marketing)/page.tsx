import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckSquare, BarChart3, Users, Bell, Zap, Shield, ArrowRight, Star } from "lucide-react";

export default async function LandingPage() {
    const session = await auth();

    // Already logged in → go straight to dashboard
    if (session?.user) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden">
            {/* Nav */}
            <nav className="fixed top-0 w-full z-50 bg-[#050508]/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <CheckSquare className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                            TaskFlow
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">
                            Entrar
                        </Link>
                        <Link href="/register" className="text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium px-5 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20">
                            Começar grátis
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="pt-36 pb-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
                        <Zap size={12} className="fill-blue-400" />
                        Gestão de tarefas com IA para equipes
                    </div>
                    <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
                        Sua equipe organizada{" "}
                        <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                            de verdade
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Crie, delegue e acompanhe tarefas com Kanban inteligente. Gestores controlam, funcionários executam. Tudo em um só lugar.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-blue-500/30 text-base">
                            Criar conta grátis
                            <ArrowRight size={18} />
                        </Link>
                        <Link href="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-8 py-4 rounded-2xl transition-all text-base">
                            Já tenho conta
                        </Link>
                    </div>
                </div>

                {/* Hero screenshot / mockup */}
                <div className="mt-20 max-w-5xl mx-auto relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#050508] z-10 pointer-events-none" style={{ top: '60%' }} />
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/50">
                        <div className="flex items-center gap-2 mb-4 opacity-50">
                            <div className="w-3 h-3 bg-red-500 rounded-full" />
                            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                            <div className="w-3 h-3 bg-green-500 rounded-full" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { col: "A Fazer", count: 3, color: "border-blue-500/40 bg-blue-500/5" },
                                { col: "Em Progresso", count: 2, color: "border-amber-500/40 bg-amber-500/5" },
                                { col: "Concluído", count: 5, color: "border-emerald-500/40 bg-emerald-500/5" },
                            ].map(({ col, count, color }) => (
                                <div key={col} className={`border ${color} rounded-xl p-3 space-y-2`}>
                                    <p className="text-xs font-medium text-gray-400">{col} · {count}</p>
                                    {Array.from({ length: count }).map((_, i) => (
                                        <div key={i} className="h-10 bg-white/5 rounded-lg border border-white/5" />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-24 px-6 bg-gradient-to-b from-transparent to-zinc-950/50">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
                        Tudo que sua equipe precisa
                    </h2>
                    <p className="text-gray-400 text-center mb-14 max-w-xl mx-auto">
                        Do Gestor ao Funcionário, cada role tem exatamente o que precisa.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: CheckSquare, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "Kanban Inteligente", desc: "Visualize o fluxo de trabalho em colunas. Arraste e solte para atualizar o status." },
                            { icon: Users, color: "text-purple-400 bg-purple-500/10 border-purple-500/20", title: "Gestão de Equipe", desc: "Gestores adicionam membros, delegam tarefas e acompanham quem está fazendo o quê." },
                            { icon: Zap, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", title: "Tarefa Mágica com IA", desc: "Gere tarefas automaticamente com IA baseado no seu projeto e contexto." },
                            { icon: Bell, color: "text-pink-400 bg-pink-500/10 border-pink-500/20", title: "Lembretes", desc: "Nunca perca um prazo. Configure alertas para você e sua equipe." },
                            { icon: BarChart3, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", title: "Relatórios", desc: "Acompanhe a produtividade da equipe com gráficos e métricas em tempo real." },
                            { icon: Shield, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", title: "Controle de Acesso", desc: "Gestores criam e deletam. Funcionários executam. Simples e seguro." },
                        ].map(({ icon: Icon, color, title, desc }) => (
                            <div key={title} className="bg-zinc-900/60 border border-white/8 rounded-2xl p-6 hover:border-white/15 transition-all group">
                                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${color}`}>
                                    <Icon size={20} />
                                </div>
                                <h3 className="font-semibold text-white mb-2">{title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Social proof */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-center gap-1 mb-3">
                        {[...Array(5)].map((_, i) => <Star key={i} size={18} className="text-amber-400 fill-amber-400" />)}
                    </div>
                    <p className="text-center text-gray-300 text-lg italic max-w-xl mx-auto">
                        "O TaskFlow transformou a forma como organizamos nossas demandas. A visão Kanban e a delegação por role foram um divisor de águas."
                    </p>
                    <p className="text-center text-gray-500 text-sm mt-4">— Adriano D., Gestor de Projetos</p>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-6">
                <div className="max-w-3xl mx-auto bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-white/10 rounded-3xl p-12 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para organizar sua equipe?</h2>
                    <p className="text-gray-400 mb-8">Cadastre-se e comece a usar em menos de 2 minutos.</p>
                    <Link href="/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold px-10 py-4 rounded-2xl transition-all shadow-2xl shadow-blue-500/30 text-base">
                        Criar minha conta
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 px-6 text-center text-gray-500 text-sm">
                <p>© 2025 TaskFlow. Feito com 💜 para equipes que entregam.</p>
            </footer>
        </div>
    );
}
