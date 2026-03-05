"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Action {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    color?: string; // Tailwind class like "bg-blue-600"
}

interface MobileFABProps {
    mainAction?: Action; // If provided, FAB is a single button (no toggle)
    actions?: Action[];  // If provided, FAB expands to show these (Speed Dial)
    icon?: React.ReactNode; // Custom icon for the main FAB button (default is Plus)
    className?: string;  // Custom class for the main button
}

export default function MobileFAB({
    mainAction,
    actions = [],
    icon,
    className
}: MobileFABProps) {
    const [isOpen, setIsOpen] = useState(false);

    // If mainAction is provided, it's a simple button, not a menu
    if (mainAction) {
        return (
            <div className="md:hidden fixed bottom-6 right-6 z-50">
                <button
                    onClick={mainAction.onClick}
                    className={cn(
                        "w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 text-white",
                        mainAction.color || "bg-primary",
                        className
                    )}
                >
                    {icon || mainAction.icon || <Plus size={28} />}
                </button>
            </div>
        );
    }

    // Otherwise, it's a Speed Dial menu
    return (
        <div className="md:hidden fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-[1px] z-[-1] animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Menu Items */}
            {isOpen && actions.length > 0 && (
                <div className="flex flex-col items-end gap-3 animate-in slide-in-from-bottom-5 fade-in duration-200">
                    {actions.map((action, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                action.onClick();
                                setIsOpen(false);
                            }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full shadow-lg font-medium text-sm text-white transition-all hover:scale-105 active:scale-95",
                                action.color || "bg-primary"
                            )}
                        >
                            <span>{action.label}</span>
                            {action.icon}
                        </button>
                    ))}
                </div>
            )}

            {/* Main Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 text-white z-50",
                    isOpen ? "bg-red-500 rotate-90" : "bg-blue-600 rotate-0",
                    className
                )}
            >
                {isOpen ? <X size={24} /> : (icon || <Plus size={28} />)}
            </button>
        </div>
    );
}
