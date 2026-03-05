"use client";

import { logout } from "@/app/lib/actions";
import { LayoutDashboard, Users, User, Settings, LogOut, CheckSquare, BarChart3, Bell, Calendar } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar({ user, className, onLinkClick }: { user: any, className?: string, onLinkClick?: () => void }) {
    return (
        <aside className={`w-64 bg-card border-r border-border h-screen flex flex-col p-4 ${className}`}>
            {/* Logo / Brand */}
            <div className="mb-8 px-2 flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <CheckSquare className="text-primary-foreground w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    TaskFlow
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
                <NavItem href="/" icon={LayoutDashboard} label="Tarefas / Board" onClick={onLinkClick} />
                <NavItem href="/lembretes" icon={Bell} label="Lembretes" onClick={onLinkClick} />
                <NavItem href="/agenda" icon={Calendar} label="Agenda" onClick={onLinkClick} />
                <NavItem href="/reports" icon={BarChart3} label="Relatórios" onClick={onLinkClick} />
                <NavItem href="#" icon={Users} label="Equipe" onClick={onLinkClick} />
                <NavItem href="/configuracoes" icon={Settings} label="Configurações" onClick={onLinkClick} />
            </nav>

            {/* User / Footer */}
            <div className="border-t border-border pt-4 mt-auto">
                <div className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted transition-colors">
                    {/* Profile Link */}
                    <Link
                        href="/perfil"
                        className="flex items-center gap-3 flex-1 min-w-0"
                        onClick={onLinkClick}
                    >
                        <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-500/30">
                            {user?.name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="flex flex-col min-w-0 text-left">
                            <span className="text-sm font-medium text-foreground truncate">{user?.name || "Usuário"}</span>
                            <span className="text-xs text-muted-foreground truncate">{user?.email || ""}</span>
                        </div>
                    </Link>

                    {/* Logout Button */}
                    <form action={logout}>
                        <button type="submit" className="text-muted-foreground hover:text-red-400 p-1 rounded-md transition-colors" title="Sair">
                            <LogOut size={18} />
                        </button>
                    </form>
                </div>
            </div>
        </aside>
    );
}

function NavItem({ href, icon: Icon, label, onClick }: { href: string; icon: any; label: string; onClick?: () => void }) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            onClick={onClick}
            className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
        ${isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
      `}
        >
            <Icon size={20} />
            <span>{label}</span>
            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
        </Link>
    );
}
