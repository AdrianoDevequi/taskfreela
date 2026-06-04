"use client";

import { logout } from "@/app/lib/actions";
import { LayoutDashboard, Users, User, Settings, LogOut, CheckSquare, BarChart3, Bell, Calendar, Briefcase, ShieldAlert, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useSimpleMode } from "@/app/context/SimpleModeContext";

export default function Sidebar({ user, className, onLinkClick, collapsed = false, onToggleCollapse }: {
    user: any;
    className?: string;
    onLinkClick?: () => void;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}) {
    const { isSimpleMode } = useSimpleMode();

    return (
        <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-card border-r border-border h-screen flex flex-col transition-all duration-200 ${className}`}>
            {/* Logo / Brand */}
            <div className={`mb-8 px-3 pt-4 flex items-center ${collapsed ? 'justify-center' : 'gap-2 px-4'}`}>
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
                    <CheckSquare className="text-primary-foreground w-5 h-5" />
                </div>
                {!collapsed && (
                    <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        TaskFreela
                    </h1>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-2">
                <NavItem href="/dashboard" icon={LayoutDashboard} label="Tarefas / Board" onClick={onLinkClick} collapsed={collapsed} />
                {!isSimpleMode && <NavItem href="/projetos" icon={Briefcase} label="Projetos" onClick={onLinkClick} collapsed={collapsed} />}
                <NavItem href="/lembretes" icon={Bell} label="Lembretes" onClick={onLinkClick} collapsed={collapsed} />
                <NavItem href="/agenda" icon={Calendar} label="Agenda" onClick={onLinkClick} collapsed={collapsed} />
                <NavItem href="/whatsapp" icon={MessageCircle} label="WhatsApp" onClick={onLinkClick} collapsed={collapsed} />
                <NavItem href="/reports" icon={BarChart3} label="Relatórios" onClick={onLinkClick} collapsed={collapsed} />
                {!isSimpleMode && <NavItem href="/equipe" icon={Users} label="Equipe" onClick={onLinkClick} collapsed={collapsed} />}
                {!isSimpleMode && user?.isSuperAdmin && <NavItem href="/usuarios" icon={ShieldAlert} label="Usuários" onClick={onLinkClick} collapsed={collapsed} />}
                <NavItem href="/configuracoes" icon={Settings} label="Configurações" onClick={onLinkClick} collapsed={collapsed} />
            </nav>

            {/* Collapse Toggle */}
            {onToggleCollapse && (
                <div className={`px-2 pb-3 ${collapsed ? 'flex justify-center' : ''}`}>
                    <button
                        onClick={onToggleCollapse}
                        title={collapsed ? "Expandir menu" : "Recolher menu"}
                        className={`
                            group relative flex items-center gap-2 rounded-xl border border-border/60
                            bg-muted/40 hover:bg-primary/10 hover:border-primary/40
                            text-muted-foreground hover:text-primary
                            transition-all duration-200 shadow-sm hover:shadow-primary/10 hover:shadow-md
                            ${collapsed ? 'w-10 h-10 justify-center' : 'w-full px-3 py-2.5'}
                        `}
                    >
                        <div className="shrink-0 w-6 h-6 rounded-md bg-background border border-border/60 group-hover:border-primary/40 flex items-center justify-center transition-all duration-200">
                            {collapsed
                                ? <ChevronRight size={13} className="translate-x-px" />
                                : <ChevronLeft size={13} className="-translate-x-px" />
                            }
                        </div>
                        {!collapsed && (
                            <span className="text-xs font-medium">Recolher menu</span>
                        )}
                    </button>
                </div>
            )}

            {/* User / Footer */}
            <div className="border-t border-border pt-4 pb-4 mt-auto px-2">
                <div className={`flex items-center w-full p-2 rounded-lg hover:bg-muted transition-colors ${collapsed ? 'justify-center' : 'gap-3'}`}>
                    {collapsed ? (
                        <Link href="/perfil" onClick={onLinkClick} title={user?.name || "Perfil"}>
                            <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-500/30">
                                {user?.name?.[0]?.toUpperCase() || "U"}
                            </div>
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/perfil"
                                className="flex items-center gap-3 flex-1 min-w-0"
                                onClick={onLinkClick}
                            >
                                <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-500/30">
                                    {user?.name?.[0]?.toUpperCase() || "U"}
                                </div>
                                <div className="flex flex-col min-w-0 text-left">
                                    <span className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                                        {user?.name || "Usuário"}
                                        {user?.isSuperAdmin && (
                                            <span className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border border-purple-500/30">
                                                ADM
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate">{user?.email || ""}</span>
                                </div>
                            </Link>
                            <form action={logout}>
                                <button type="submit" className="text-muted-foreground hover:text-red-400 p-1 rounded-md transition-colors" title="Sair">
                                    <LogOut size={18} />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
}

function NavItem({ href, icon: Icon, label, onClick, collapsed }: {
    href: string;
    icon: any;
    label: string;
    onClick?: () => void;
    collapsed?: boolean;
}) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            onClick={onClick}
            title={collapsed ? label : undefined}
            className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
            `}
        >
            <Icon size={20} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
            {!collapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
        </Link>
    );
}
