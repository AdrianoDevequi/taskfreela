"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, Building } from "lucide-react";
import { useRouter } from "next/navigation";

interface Workspace {
    id: string;
    name: string;
    role: string;
}

export function WorkspaceSwitcher() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSwitching, setIsSwitching] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchWorkspaces();
        
        // Try to get the active workspace from next auth session or local storage
        // A better way is to rely on an endpoint that returns the full user profile including activeWorkspaceId
        fetch("/api/reports") // Just to check session minimally, or better create a /api/me endpoint
            .then(() => fetch("/api/workspaces"))
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setWorkspaces(data);
                }
            })
            .finally(() => setIsLoading(false));
            
        // For simplicity we will determine active workspace by what the user sets
        // Realistically, the active workspace ID should come from the session token.
        // As a fallback, we fetch /api/auth/session or assume first one if not set
        fetch("/api/auth/session")
            .then(res => res.json())
            .then(session => {
                if (session?.user?.workspaceId) {
                    setActiveWorkspaceId(session.user.workspaceId);
                }
            });
    }, []);

    const fetchWorkspaces = async () => {
        try {
            const res = await fetch("/api/workspaces");
            const data = await res.json();
            if (Array.isArray(data)) {
                setWorkspaces(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleSwitch = async (workspaceId: string) => {
        if (workspaceId === activeWorkspaceId) {
            setIsOpen(false);
            return;
        }

        setIsSwitching(true);
        try {
            const res = await fetch("/api/workspaces/switch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceId }),
            });

            if (res.ok) {
                setActiveWorkspaceId(workspaceId);
                setIsOpen(false);
                // Hard refresh to reload all data with new workspace token
                window.location.href = "/dashboard";
            } else {
                alert("Falha ao trocar de equipe");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSwitching(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col mb-6 mt-2 px-3">
                <div className="h-10 animate-pulse bg-muted rounded-xl w-full"></div>
            </div>
        );
    }

    if (workspaces.length === 0) return null;

    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

    return (
        <div className="flex flex-col mb-6 mt-2 px-3 relative">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">
                Sua Equipe
            </span>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-xl px-3 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
                <div className="flex items-center gap-2 truncate">
                    <div className="min-w-6 min-h-6 h-6 w-6 rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {activeWorkspace?.name.charAt(0) || <Building size={12} />}
                    </div>
                    <span className="text-sm font-semibold truncate text-foreground text-left">
                        {activeWorkspace?.name || "Carregando..."}
                    </span>
                </div>
                <ChevronsUpDown size={14} className="text-muted-foreground shrink-0 ml-2" />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-3 right-3 mt-1.5 bg-card border border-border rounded-xl shadow-lg z-50 py-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[250px] overflow-y-auto">
                        {workspaces.map((ws) => (
                            <button
                                key={ws.id}
                                onClick={() => handleSwitch(ws.id)}
                                disabled={isSwitching}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors
                                    ${activeWorkspaceId === ws.id ? 'bg-primary/5' : ''}
                                `}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <div className={`h-6 w-6 rounded-md flex items-center justify-center font-bold text-xs uppercase shrink-0 ${activeWorkspaceId === ws.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                                        {ws.name.charAt(0)}
                                    </div>
                                    <div className="flex flex-col truncate">
                                        <span className={`font-medium truncate ${activeWorkspaceId === ws.id ? 'text-primary' : 'text-foreground'}`}>
                                            {ws.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground uppercase">
                                            {ws.role}
                                        </span>
                                    </div>
                                </div>
                                {activeWorkspaceId === ws.id && (
                                    <Check size={14} className="text-primary shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>
                    {/* Placeholder for future "Create new workspace" flow */}
                    {/* <div className="px-1 pt-1 border-t border-border mt-1">
                        <button className="w-full flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg px-2 py-2 text-xs font-semibold transition-colors">
                            <Plus size={14} /> Nova Equipe
                        </button>
                    </div> */}
                </div>
            )}
            
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
