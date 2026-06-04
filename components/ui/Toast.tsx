"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; message: string };
type ConfirmOpts = {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
};

type ToastApi = {
    toast: {
        success: (message: string) => void;
        error: (message: string) => void;
        info: (message: string) => void;
    };
    confirm: (opts: ConfirmOpts) => Promise<boolean>;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast deve ser usado dentro de <ToastProvider>");
    return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [confirmState, setConfirmState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
    const idRef = useRef(0);

    const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
    const add = useCallback(
        (type: ToastType, message: string) => {
            const id = ++idRef.current;
            setToasts((t) => [...t, { id, type, message }]);
            setTimeout(() => remove(id), 4500);
        },
        [remove]
    );

    const apiRef = useRef<ToastApi>({
        toast: {
            success: (m: string) => add("success", m),
            error: (m: string) => add("error", m),
            info: (m: string) => add("info", m),
        },
        confirm: (opts: ConfirmOpts) =>
            new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
    });

    function resolveConfirm(value: boolean) {
        confirmState?.resolve(value);
        setConfirmState(null);
    }

    return (
        <ToastContext.Provider value={apiRef.current}>
            {children}

            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none">
                {toasts.map((t) => (
                    <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
                ))}
            </div>

            {confirmState && <ConfirmModal opts={confirmState} onResolve={resolveConfirm} />}
        </ToastContext.Provider>
    );
}

const TOAST_STYLES: Record<ToastType, { icon: any; cls: string; iconCls: string }> = {
    success: { icon: CheckCircle2, cls: "border-green-500/40", iconCls: "text-green-500" },
    error: { icon: XCircle, cls: "border-red-500/40", iconCls: "text-red-400" },
    info: { icon: Info, cls: "border-primary/40", iconCls: "text-primary" },
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
    const s = TOAST_STYLES[item.type];
    const Icon = s.icon;
    return (
        <div
            className={`pointer-events-auto flex items-start gap-3 bg-card border ${s.cls} rounded-xl shadow-xl px-4 py-3 animate-in slide-in-from-bottom-2 fade-in duration-200`}
        >
            <Icon size={18} className={`${s.iconCls} shrink-0 mt-0.5`} />
            <p className="text-sm text-foreground flex-1 break-words">{item.message}</p>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
                <X size={15} />
            </button>
        </div>
    );
}

function ConfirmModal({
    opts,
    onResolve,
}: {
    opts: ConfirmOpts;
    onResolve: (v: boolean) => void;
}) {
    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => onResolve(false)}
        >
            <div
                className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3 mb-4">
                    {opts.danger && (
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-400 shrink-0">
                            <AlertTriangle size={20} />
                        </div>
                    )}
                    <div>
                        {opts.title && <h3 className="text-lg font-bold mb-1">{opts.title}</h3>}
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{opts.message}</p>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => onResolve(false)}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/70 transition-colors"
                    >
                        {opts.cancelLabel || "Cancelar"}
                    </button>
                    <button
                        onClick={() => onResolve(true)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 ${
                            opts.danger
                                ? "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20"
                                : "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                        }`}
                    >
                        {opts.confirmLabel || "Confirmar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
