"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu, X } from "lucide-react";

export default function DashboardShell({
    children,
    user,
}: {
    children: React.ReactNode;
    user: any;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen w-full bg-background overflow-hidden">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background border-b border-border flex items-center justify-between px-4 z-40">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-md"
                    >
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-lg">TaskFlow</span>
                </div>
            </div>

            {/* Sidebar (Desktop) */}
            <div className="hidden md:block h-full">
                <Sidebar user={user} />
            </div>

            {/* Sidebar (Mobile Drawer) */}
            {isSidebarOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setIsSidebarOpen(false)}
                    />

                    {/* Drawer */}
                    <div className="relative w-64 h-full bg-card shadow-xl animate-in slide-in-from-left duration-200">
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"
                        >
                            <X size={20} />
                        </button>
                        <Sidebar
                            user={user}
                            className="border-none"
                            onLinkClick={() => setIsSidebarOpen(false)}
                        />
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto h-full w-full pt-24 md:pt-6 px-4 md:px-6 pb-6 scroll-smooth">
                {children}
            </main>
        </div>
    );
}
