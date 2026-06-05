"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Loader2,
    Search,
    Send,
    Check,
    CheckCheck,
    RefreshCw,
    Users,
    User,
    AlertCircle,
    Inbox as InboxIcon,
    ArrowLeft,
    Image as ImageIcon,
    Video as VideoIcon,
    Mic,
    FileText,
    Download,
    EyeOff,
    Archive,
    Pencil,
    Pin,
    PinOff,
    Tag,
} from "lucide-react";
import { WhatsappTabs } from "./WhatsappTabs";
import { Dropdown, MultiDropdown } from "./FilterDropdown";
import { useToast } from "@/components/ui/Toast";
import {
    listChats,
    getChatMessages,
    sendReply,
    markChatRead,
    setChatResolved,
    setChatIgnored,
    setChatArchived,
    setChatCustomName,
    setChatPinned,
    setChatColor,
    getMessageMedia,
    type ChatFilters,
} from "@/app/actions/whatsapp";

type Chat = {
    id: string;
    instanceId: string;
    instanceLabel: string;
    remoteJid: string;
    type: string;
    name: string | null;
    lastMessageAt: string | Date | null;
    lastFromMe: boolean;
    lastPreview: string | null;
    unreadCount: number;
    priority: string;
    status: string;
    firstPendingAt: string | Date | null;
    lastResponseSeconds: number | null;
    isMuted: boolean;
    ignored: boolean;
    archived: boolean;
    customName: string | null;
    profilePicUrl: string | null;
    pinnedAt: string | Date | null;
    color: string | null;
};

type InstanceLite = { id: string; instanceName: string; profileName: string | null };

type Message = {
    id: string;
    fromMe: boolean;
    preview: string | null;
    type: string;
    timestamp: string | Date;
};

const POLL_MS = 8000;
const FILTERS_STORAGE_KEY = "taskfreela.whatsapp.filters.v1";

function hasActiveFilters(f: ChatFilters): boolean {
    return Boolean(
        (f.instanceIds && f.instanceIds.length) ||
            f.status ||
            f.type ||
            f.search ||
            f.includeLow ||
            f.pinnedOnTop === false
    );
}

function fmtTime(value: string | Date | null): string {
    if (!value) return "";
    const d = new Date(value);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
        ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtDuration(fromValue: string | Date | null): string {
    if (!fromValue) return "";
    const secs = Math.max(0, Math.round((Date.now() - new Date(fromValue).getTime()) / 1000));
    return humanizeSeconds(secs);
}

function humanizeSeconds(secs: number): string {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}min`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
}

function jidNumber(jid: string): string {
    return jid.split("@")[0];
}

function priorityDot(priority: string): string {
    if (priority === "high") return "bg-red-500";
    if (priority === "medium") return "bg-amber-500";
    return "bg-muted-foreground/40";
}

function ChatAvatar({ url, isGroup, className, iconSize }: { url?: string | null; isGroup: boolean; className: string; iconSize: number }) {
    const [err, setErr] = useState(false);
    if (url && !err) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={url} alt="" onError={() => setErr(true)} className={`${className} object-cover bg-muted`} />;
    }
    return (
        <div className={`${className} bg-muted flex items-center justify-center text-muted-foreground`}>
            {isGroup ? <Users size={iconSize} /> : <User size={iconSize} />}
        </div>
    );
}

const COLOR_PALETTE: { value: string; label: string; bg: string; border: string }[] = [
    { value: "red", label: "Importante", bg: "bg-red-500", border: "border-red-500" },
    { value: "orange", label: "Urgente", bg: "bg-orange-500", border: "border-orange-500" },
    { value: "amber", label: "Atenção", bg: "bg-amber-500", border: "border-amber-500" },
    { value: "green", label: "OK", bg: "bg-green-500", border: "border-green-500" },
    { value: "blue", label: "Acompanhar", bg: "bg-blue-500", border: "border-blue-500" },
    { value: "purple", label: "Pessoal", bg: "bg-purple-500", border: "border-purple-500" },
];
function colorClasses(value: string | null) {
    return COLOR_PALETTE.find((c) => c.value === value);
}

function chatNames(chat: { customName?: string | null; name: string | null; remoteJid: string }) {
    const original = chat.name || jidNumber(chat.remoteJid);
    return chat.customName
        ? { primary: chat.customName, secondary: original }
        : { primary: original, secondary: null as string | null };
}

export function InboxClient({
    initialChats,
    instances,
}: {
    initialChats: Chat[];
    instances: InstanceLite[];
}) {
    const { toast, confirm } = useToast();
    const [chats, setChats] = useState<Chat[]>(initialChats);
    const [filters, setFilters] = useState<ChatFilters>({});
    const [selected, setSelected] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const filtersRef = useRef(filters);
    filtersRef.current = filters;
    const selectedRef = useRef(selected);
    selectedRef.current = selected;
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const autoOpenedRef = useRef(false);
    const hydratedRef = useRef(false);

    // hidratação: lê filtros salvos no localStorage (1x ao montar)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw) as ChatFilters;
                if (saved && typeof saved === "object") setFilters(saved);
            }
        } catch {
            /* ignore */
        }
        hydratedRef.current = true;
    }, []);

    // persistência: salva no localStorage a cada mudança (após hidratar)
    useEffect(() => {
        if (!hydratedRef.current) return;
        try {
            localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
        } catch {
            /* ignore */
        }
    }, [filters]);

    const refreshList = useCallback(async () => {
        try {
            const res = await listChats(filtersRef.current);
            setChats(res.chats as Chat[]);
        } catch {
            /* ignore poll errors */
        }
    }, []);

    // refetch when filters change
    useEffect(() => {
        setRefreshing(true);
        refreshList().finally(() => setRefreshing(false));
    }, [filters, refreshList]);

    // polling — lista + (se houver conversa aberta) mensagens novas em tempo real.
    // Usa skipRemote: lê só do banco, que é alimentado pelo webhook em tempo real.
    useEffect(() => {
        const id = setInterval(async () => {
            refreshList();
            const sel = selectedRef.current;
            if (!sel) return;
            try {
                const res = await getChatMessages(sel.id, true);
                const next = res.messages as Message[];
                setMessages((prev) => {
                    const changed =
                        next.length !== prev.length ||
                        (next.length > 0 && prev.length > 0 && next[next.length - 1].id !== prev[prev.length - 1].id);
                    return changed ? next : prev;
                });
            } catch {
                /* ignore poll errors */
            }
        }, POLL_MS);
        return () => clearInterval(id);
    }, [refreshList]);

    // deep link: /whatsapp?chat=<id> abre a conversa automaticamente
    useEffect(() => {
        if (autoOpenedRef.current || selected) return;
        const chatId = new URLSearchParams(window.location.search).get("chat");
        if (!chatId) return;
        const chat = chats.find((c) => c.id === chatId);
        if (chat) {
            autoOpenedRef.current = true;
            openChat(chat);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chats]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function openChat(chat: Chat) {
        setSelected(chat);
        setMessages([]);
        setLoadingMsgs(true);
        try {
            const res = await getChatMessages(chat.id);
            setMessages(res.messages as Message[]);
            const pic = (res.chat as any)?.profilePicUrl;
            if (pic) setSelected((prev) => (prev && prev.id === chat.id ? { ...prev, profilePicUrl: pic } : prev));
            if (chat.unreadCount > 0) {
                markChatRead(chat.id).then(refreshList);
            }
        } catch (e: any) {
            toast.error(e?.message || "Erro ao abrir conversa.");
        } finally {
            setLoadingMsgs(false);
        }
    }

    async function handleSend() {
        if (!selected || !reply.trim()) return;
        const text = reply.trim();
        const ok = await confirm({
            title: "Enviar mensagem",
            message: `Enviar para ${selected.name || jidNumber(selected.remoteJid)}?\n\n"${text}"`,
            confirmLabel: "Enviar",
        });
        if (!ok) return;
        setSending(true);
        try {
            const res = await sendReply(selected.id, text);
            if (res.success) {
                setReply("");
                const updated = await getChatMessages(selected.id);
                setMessages(updated.messages as Message[]);
                refreshList();
            } else {
                toast.error(res.error);
            }
        } finally {
            setSending(false);
        }
    }

    async function handleResolve(chat: Chat) {
        await setChatResolved(chat.id, chat.status !== "resolved");
        refreshList();
        if (selected?.id === chat.id) {
            setSelected({ ...chat, status: chat.status !== "resolved" ? "resolved" : "answered" });
        }
    }

    async function handleIgnore(chat: Chat) {
        const next = !chat.ignored;
        await setChatIgnored(chat.id, next);
        refreshList();
        if (selected?.id === chat.id) setSelected({ ...chat, ignored: next });
    }

    async function handlePin(chat: Chat) {
        const willPin = !chat.pinnedAt;
        await setChatPinned(chat.id, willPin);
        refreshList();
        if (selected?.id === chat.id) {
            setSelected({ ...chat, pinnedAt: willPin ? new Date().toISOString() : null });
        }
    }

    async function handleColor(chat: Chat, color: string) {
        await setChatColor(chat.id, color);
        refreshList();
        if (selected?.id === chat.id) setSelected({ ...chat, color: color || null });
    }

    async function handleArchive(chat: Chat) {
        const next = !chat.archived;
        await setChatArchived(chat.id, next);
        refreshList();
        if (selected?.id === chat.id) {
            if (next) setSelected(null);
            else setSelected({ ...chat, archived: false });
        }
    }

    const pendingCount = chats.filter((c) => c.status === "pending" && !c.ignored).length;

    return (
        <div className="max-w-6xl mx-auto py-6 h-[calc(100vh-3rem)] flex flex-col">
            <div className="mb-2 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-1">WhatsApp</h1>
                    <p className="text-muted-foreground">
                        Inbox unificado · {pendingCount > 0 ? `${pendingCount} sem resposta` : "tudo respondido"}
                    </p>
                </div>
                <button
                    onClick={() => { setRefreshing(true); refreshList().finally(() => setRefreshing(false)); }}
                    className="flex items-center gap-2 bg-muted hover:bg-muted/70 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                    <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Atualizar
                </button>
            </div>
            <WhatsappTabs />

            {instances.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                        <InboxIcon size={40} className="mx-auto mb-3 opacity-40" />
                        <p className="mb-3">Nenhum WhatsApp conectado ainda.</p>
                        <a href="/whatsapp/conexoes" className="text-primary font-semibold hover:underline">
                            Conectar um WhatsApp →
                        </a>
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 flex gap-4">
                    {/* Conversation list */}
                    <div className={`w-full md:w-[380px] shrink-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden ${selected ? "hidden md:flex" : "flex"}`}>
                        {/* Filters */}
                        <div className="p-3 border-b border-border space-y-2">
                            <div className="relative">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={filters.search || ""}
                                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
                                    placeholder="Buscar nome, número ou texto..."
                                    className="w-full bg-muted/50 border border-input rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <MultiDropdown
                                    allLabel="Todas as contas"
                                    values={filters.instanceIds || []}
                                    onChange={(ids) => setFilters((f) => ({ ...f, instanceIds: ids.length ? ids : undefined }))}
                                    options={instances.map((i) => ({ value: i.id, label: i.profileName || i.instanceName }))}
                                />
                                <Dropdown
                                    value={filters.status || ""}
                                    onChange={(v) => setFilters((f) => ({ ...f, status: (v || undefined) as ChatFilters["status"] }))}
                                    options={[
                                        { value: "", label: "Todos status" },
                                        { value: "pending", label: "Sem resposta" },
                                        { value: "unread", label: "Não lidas" },
                                        { value: "answered", label: "Respondidas" },
                                        { value: "resolved", label: "Resolvidas" },
                                        { value: "archived", label: "Arquivadas" },
                                    ]}
                                />
                                <Dropdown
                                    value={filters.type || ""}
                                    onChange={(v) => setFilters((f) => ({ ...f, type: (v || undefined) as ChatFilters["type"] }))}
                                    options={[
                                        { value: "", label: "Pessoas e grupos" },
                                        { value: "person", label: "Pessoas" },
                                        { value: "group", label: "Grupos" },
                                    ]}
                                />
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1.5">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(filters.includeLow)}
                                        onChange={(e) => setFilters((f) => ({ ...f, includeLow: e.target.checked || undefined }))}
                                    />
                                    Não salvos
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1.5">
                                    <input
                                        type="checkbox"
                                        checked={filters.pinnedOnTop !== false}
                                        onChange={(e) => setFilters((f) => ({ ...f, pinnedOnTop: e.target.checked ? undefined : false }))}
                                    />
                                    Fixadas no topo
                                </label>
                                {hasActiveFilters(filters) && (
                                    <button
                                        onClick={() => setFilters({})}
                                        className="text-[11px] font-semibold text-primary hover:underline px-2 py-1.5 ml-auto"
                                        title="Limpar todos os filtros"
                                    >
                                        Limpar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                            {chats.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">
                                    Nenhuma conversa. Sincronize uma instância em Conexões.
                                </div>
                            ) : (
                                chats.map((chat) => {
                                    const color = colorClasses(chat.color);
                                    return (
                                    <button
                                        key={chat.id}
                                        onClick={() => openChat(chat)}
                                        className={`relative w-full text-left px-3 py-3 border-b border-border/60 hover:bg-muted/40 transition-colors flex gap-3 ${
                                            selected?.id === chat.id ? "bg-muted/60" : ""
                                        } ${color ? `border-l-4 ${color.border} pl-2` : ""}`}
                                    >
                                        {chat.pinnedAt && (
                                            <Pin
                                                size={11}
                                                className="absolute top-1.5 right-2 text-primary fill-primary/40 -rotate-45"
                                            />
                                        )}
                                        <div className="relative shrink-0">
                                            <ChatAvatar url={chat.profilePicUrl} isGroup={chat.type === "group"} className="w-10 h-10 rounded-full" iconSize={18} />
                                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${priorityDot(chat.priority)}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-sm truncate">
                                                    {chatNames(chat).primary}
                                                    {chatNames(chat).secondary && (
                                                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">· {chatNames(chat).secondary}</span>
                                                    )}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(chat.lastMessageAt)}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                    {chat.lastFromMe && <CheckCheck size={13} className="shrink-0 text-muted-foreground" />}
                                                    {chat.lastPreview || "—"}
                                                </span>
                                                {chat.unreadCount > 0 && (
                                                    <span className="bg-green-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                                                        {chat.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-muted-foreground truncate">{chat.instanceLabel}</span>
                                                {chat.status === "pending" && !chat.ignored && (
                                                    <span className="text-[10px] font-semibold text-red-400 flex items-center gap-1">
                                                        <AlertCircle size={11} /> sem resposta há {fmtDuration(chat.firstPendingAt)}
                                                    </span>
                                                )}
                                                {chat.ignored && (
                                                    <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                                                        <EyeOff size={11} /> ignorada
                                                    </span>
                                                )}
                                                {chat.status === "resolved" && !chat.ignored && !chat.archived && (
                                                    <span className="text-[10px] font-semibold text-blue-400">resolvida</span>
                                                )}
                                                {chat.archived && (
                                                    <span className="text-[10px] font-semibold text-blue-400 flex items-center gap-1">
                                                        <Archive size={11} /> arquivada
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Conversation panel */}
                    <div className={`flex-1 min-w-0 flex flex-col bg-card border border-border rounded-xl overflow-hidden ${selected ? "flex" : "hidden md:flex"}`}>
                        {!selected ? (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                <div className="text-center">
                                    <InboxIcon size={40} className="mx-auto mb-3 opacity-40" />
                                    Selecione uma conversa
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <button onClick={() => setSelected(null)} className="md:hidden p-1 text-muted-foreground">
                                            <ArrowLeft size={18} />
                                        </button>
                                        <ChatAvatar url={selected.profilePicUrl} isGroup={selected.type === "group"} className="w-9 h-9 rounded-full shrink-0" iconSize={16} />
                                        <div className="min-w-0">
                                            <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                                                <span className="truncate">{chatNames(selected).primary}</span>
                                                {chatNames(selected).secondary && (
                                                    <span className="text-[11px] font-normal text-muted-foreground truncate shrink">
                                                        ({chatNames(selected).secondary})
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => setEditingName(true)}
                                                    className="text-muted-foreground hover:text-foreground shrink-0"
                                                    title="Nome customizado (aparece só no sistema)"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground truncate">
                                                {selected.instanceLabel}
                                                {selected.lastResponseSeconds != null &&
                                                    ` · última resposta em ${humanizeSeconds(selected.lastResponseSeconds)}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => handlePin(selected)}
                                            className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                selected.pinnedAt ? "bg-primary/10 text-primary" : "bg-muted hover:bg-muted/70"
                                            }`}
                                            title={selected.pinnedAt ? "Desafixar" : "Fixar no topo"}
                                        >
                                            {selected.pinnedAt ? <PinOff size={14} /> : <Pin size={14} />}
                                        </button>
                                        <div className="relative">
                                            <button
                                                onClick={() => setColorPickerOpen((v) => !v)}
                                                className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                    selected.color ? "" : "bg-muted hover:bg-muted/70"
                                                }`}
                                                style={selected.color ? { backgroundColor: `var(--${selected.color}-500, transparent)` } : undefined}
                                                title="Marcar com cor / etiqueta"
                                            >
                                                {selected.color ? (
                                                    <span className={`w-3.5 h-3.5 rounded-full block ${colorClasses(selected.color)?.bg || ""}`} />
                                                ) : (
                                                    <Tag size={14} />
                                                )}
                                            </button>
                                            {colorPickerOpen && (
                                                <div className="absolute right-0 top-full mt-1 z-30 bg-card border border-border rounded-xl shadow-xl p-2 w-48">
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {COLOR_PALETTE.map((c) => (
                                                            <button
                                                                key={c.value}
                                                                onClick={() => { handleColor(selected, c.value); setColorPickerOpen(false); }}
                                                                className={`flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted ${
                                                                    selected.color === c.value ? "ring-2 ring-primary" : ""
                                                                }`}
                                                                title={c.label}
                                                            >
                                                                <span className={`w-4 h-4 rounded-full ${c.bg}`} />
                                                                <span className="text-[9px] text-muted-foreground">{c.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {selected.color && (
                                                        <button
                                                            onClick={() => { handleColor(selected, ""); setColorPickerOpen(false); }}
                                                            className="w-full mt-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground py-1"
                                                        >
                                                            Remover etiqueta
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleArchive(selected)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                selected.archived ? "bg-blue-500/10 text-blue-400" : "bg-muted hover:bg-muted/70"
                                            }`}
                                            title="Arquivar (some da lista)"
                                        >
                                            <Archive size={14} /> {selected.archived ? "Arquivada" : "Arquivar"}
                                        </button>
                                        <button
                                            onClick={() => handleIgnore(selected)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                selected.ignored ? "bg-amber-500/10 text-amber-400" : "bg-muted hover:bg-muted/70"
                                            }`}
                                            title="Ignorar do tempo de resposta e das métricas"
                                        >
                                            <EyeOff size={14} /> {selected.ignored ? "Ignorada" : "Ignorar"}
                                        </button>
                                        <button
                                            onClick={() => handleResolve(selected)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                selected.status === "resolved"
                                                    ? "bg-blue-500/10 text-blue-400"
                                                    : "bg-muted hover:bg-muted/70"
                                            }`}
                                            title="Marcar como resolvida"
                                        >
                                            <Check size={14} /> {selected.status === "resolved" ? "Resolvida" : "Resolver"}
                                        </button>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-background/40">
                                    {loadingMsgs ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <Loader2 className="animate-spin" />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                                            Sem mensagens carregadas.
                                        </div>
                                    ) : (
                                        messages.map((m) => <MessageBubble key={m.id} message={m} />)
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Composer */}
                                <div className="p-3 border-t border-border flex items-end gap-2">
                                    <textarea
                                        value={reply}
                                        onChange={(e) => setReply(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        rows={1}
                                        placeholder="Escreva uma resposta... (Enter envia, Shift+Enter quebra linha)"
                                        className="flex-1 resize-none bg-muted/50 border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 max-h-32"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={sending || !reply.trim()}
                                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {editingName && selected && (
                <CustomNameModal
                    chat={selected}
                    onClose={() => setEditingName(false)}
                    onSaved={(name) => {
                        setEditingName(false);
                        setSelected((prev) => (prev ? { ...prev, customName: name || null } : prev));
                        refreshList();
                    }}
                />
            )}
        </div>
    );
}

function CustomNameModal({
    chat,
    onClose,
    onSaved,
}: {
    chat: Chat;
    onClose: () => void;
    onSaved: (name: string) => void;
}) {
    const [value, setValue] = useState(chat.customName || "");
    const [saving, setSaving] = useState(false);
    const original = chat.name || jidNumber(chat.remoteJid);

    async function save() {
        setSaving(true);
        try {
            const res = await setChatCustomName(chat.id, value);
            if (res.success) onSaved(value.trim());
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-bold mb-1">Nome customizado</h3>
                <p className="text-xs text-muted-foreground mb-4">
                    Aparece só aqui no sistema. Original: <b className="text-foreground">{original}</b>
                </p>
                <input
                    autoFocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            save();
                        }
                    }}
                    placeholder="Ex.: Cliente João — Projeto X"
                    className="w-full bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <div className="flex items-center justify-between gap-2 mt-5">
                    <button
                        type="button"
                        onClick={() => setValue("")}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                        Limpar
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/70 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={save}
                            disabled={saving}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

type MediaKind = "image" | "video" | "audio" | "document" | null;

function mediaKind(type: string): MediaKind {
    if (type === "imageMessage" || type === "stickerMessage") return "image";
    if (type === "videoMessage") return "video";
    if (type === "audioMessage") return "audio";
    if (type === "documentMessage") return "document";
    return null;
}

function MessageBubble({ message }: { message: Message }) {
    const m = message;
    const kind = mediaKind(m.type);
    const [media, setMedia] = useState<{ url: string; mimetype: string; fileName?: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function loadMedia() {
        setLoading(true);
        setError(null);
        try {
            const res = await getMessageMedia(m.id);
            if (res.success && res.data) {
                // mimetype pode vir como "audio/ogg; codecs=opus" — para o data URL usamos só o tipo base
                const cleanMime = (res.data.mimetype || "application/octet-stream").split(";")[0].trim();
                setMedia({
                    url: `data:${cleanMime};base64,${res.data.base64}`,
                    mimetype: res.data.mimetype,
                    fileName: res.data.fileName,
                });
            } else if (!res.success) {
                setError(res.error);
            }
        } finally {
            setLoading(false);
        }
    }

    const caption = m.preview && !/^\[.*\]$/.test(m.preview) ? m.preview : null;
    const triggerLabel =
        kind === "image" ? "Ver imagem" : kind === "video" ? "Ver vídeo" : kind === "audio" ? "Ouvir áudio" : "Baixar documento";
    const TriggerIcon = kind === "image" ? ImageIcon : kind === "video" ? VideoIcon : kind === "audio" ? Mic : FileText;

    return (
        <div className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    m.fromMe ? "bg-green-600 text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                }`}
            >
                {kind && !media ? (
                    <div>
                        <button
                            onClick={loadMedia}
                            disabled={loading}
                            className={`flex items-center gap-2 font-medium underline-offset-2 hover:underline disabled:opacity-60 ${
                                m.fromMe ? "text-white" : "text-foreground"
                            }`}
                        >
                            {loading ? <Loader2 size={15} className="animate-spin" /> : <TriggerIcon size={15} />}
                            {triggerLabel}
                        </button>
                        {error && (
                            <p className={`text-[11px] mt-1 ${m.fromMe ? "text-white/80" : "text-muted-foreground"}`}>{error}</p>
                        )}
                    </div>
                ) : kind && media ? (
                    <div className="space-y-1">
                        {kind === "image" && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={media.url} alt="imagem" className="rounded-lg max-h-72 w-auto" />
                        )}
                        {kind === "video" && <video src={media.url} controls className="rounded-lg max-h-72 w-auto" />}
                        {kind === "audio" && <audio src={media.url} controls className="w-56 max-w-full" />}
                        {kind === "document" && (
                            <a
                                href={media.url}
                                download={media.fileName || "documento"}
                                className={`flex items-center gap-2 font-medium underline ${m.fromMe ? "text-white" : "text-primary"}`}
                            >
                                <Download size={15} /> {media.fileName || "Baixar documento"}
                            </a>
                        )}
                    </div>
                ) : (
                    <p className="whitespace-pre-wrap break-words">{m.preview || "[mídia]"}</p>
                )}

                {kind && caption && <p className="whitespace-pre-wrap break-words mt-1">{caption}</p>}

                <span className={`block text-[9px] mt-1 ${m.fromMe ? "text-white/70" : "text-muted-foreground"}`}>
                    {fmtTime(m.timestamp)}
                </span>
            </div>
        </div>
    );
}
