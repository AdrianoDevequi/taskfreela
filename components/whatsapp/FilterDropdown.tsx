"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type DropdownOption = { value: string; label: string };

function useOutsideClose(onClose: () => void) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);
    return ref;
}

const triggerCls =
    "flex items-center justify-between gap-2 bg-muted/50 border border-input rounded-lg px-3 py-1.5 text-xs hover:bg-muted transition-colors min-w-[130px]";
const panelCls =
    "absolute z-30 mt-1 min-w-full w-max max-w-[240px] bg-card border border-border rounded-xl shadow-xl py-1 max-h-64 overflow-y-auto";

/** Dropdown de seleção única, estilizado (substitui o <select> nativo). */
export function Dropdown({
    options,
    value,
    onChange,
}: {
    options: DropdownOption[];
    value: string;
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useOutsideClose(() => setOpen(false));
    const current = options.find((o) => o.value === value) || options[0];

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)} className={triggerCls}>
                <span className="truncate">{current?.label}</span>
                <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className={panelCls}>
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => {
                                onChange(o.value);
                                setOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center justify-between gap-2 ${
                                o.value === value ? "text-primary font-semibold" : "text-foreground"
                            }`}
                        >
                            <span className="truncate">{o.label}</span>
                            {o.value === value && <Check size={13} className="shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Dropdown de seleção múltipla com checkboxes. Lista vazia = "todas". */
export function MultiDropdown({
    options,
    values,
    onChange,
    allLabel,
}: {
    options: DropdownOption[];
    values: string[];
    onChange: (v: string[]) => void;
    allLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useOutsideClose(() => setOpen(false));

    const label =
        values.length === 0
            ? allLabel
            : values.length === 1
            ? options.find((o) => o.value === values[0])?.label || allLabel
            : `${values.length} selecionadas`;

    function toggle(v: string) {
        onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    }

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)} className={triggerCls}>
                <span className="truncate">{label}</span>
                <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className={panelCls}>
                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center justify-between gap-2 ${
                            values.length === 0 ? "text-primary font-semibold" : "text-foreground"
                        }`}
                    >
                        <span className="truncate">{allLabel}</span>
                        {values.length === 0 && <Check size={13} className="shrink-0" />}
                    </button>
                    <div className="my-1 border-t border-border" />
                    {options.map((o) => {
                        const checked = values.includes(o.value);
                        return (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => toggle(o.value)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2"
                            >
                                <span
                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                        checked ? "bg-primary border-primary" : "border-input"
                                    }`}
                                >
                                    {checked && <Check size={11} className="text-white" />}
                                </span>
                                <span className="truncate">{o.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
