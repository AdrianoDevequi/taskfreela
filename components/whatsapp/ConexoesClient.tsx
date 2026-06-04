"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Loader2,
    Plus,
    Wifi,
    Trash2,
    RefreshCw,
    QrCode,
    Power,
    Server,
    Smartphone,
    X,
    Download,
    Check,
    Pencil,
} from "lucide-react";
import { WhatsappTabs } from "./WhatsappTabs";
import { useToast } from "@/components/ui/Toast";
import {
    addServer,
    updateServer,
    removeServer,
    testServer,
    createInstance,
    getQrCode,
    refreshConnectionState,
    logoutInstance,
    deleteInstance,
    syncInstance,
    fetchServerInstances,
    importInstances,
    type FetchedInstance,
} from "@/app/actions/whatsapp";

type Instance = {
    id: string;
    instanceName: string;
    number: string | null;
    profileName: string | null;
    connectionStatus: string;
    lastSyncAt: Date | string | null;
};

type ServerItem = {
    id: string;
    label: string | null;
    baseUrl: string;
    createdAt: Date | string;
    instances: Instance[];
};

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        open: { label: "Conectado", cls: "bg-green-500/10 text-green-500 border-green-500/30" },
        connecting: { label: "Conectando", cls: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
        close: { label: "Desconectado", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
    };
    const s = map[status] || map.close;
    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>;
}

export function ConexoesClient({ servers }: { servers: ServerItem[] }) {
    const router = useRouter();
    const { toast, confirm } = useToast();
    const [adding, setAdding] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [qr, setQr] = useState<{ instanceId: string; image: string | null } | null>(null);
    const [newInstanceServer, setNewInstanceServer] = useState<ServerItem | null>(null);
    const [importServer, setImportServer] = useState<{ id: string; label: string | null; baseUrl: string } | null>(null);
    const [editServer, setEditServer] = useState<ServerItem | null>(null);

    async function handleAddServer(formData: FormData) {
        setAdding(true);
        try {
            const label = ((formData.get("label") as string) || "").trim() || null;
            const baseUrl = ((formData.get("baseUrl") as string) || "").trim();
            const res = await addServer(formData);
            if (res.success) {
                (document.getElementById("add-server-form") as HTMLFormElement)?.reset();
                router.refresh();
                // se o servidor já tem instâncias, abre o seletor para importar
                if (res.data?.id && res.data.found > 0) {
                    setImportServer({ id: res.data.id, label, baseUrl });
                }
            } else {
                toast.error(res.error);
            }
        } finally {
            setAdding(false);
        }
    }

    async function handleShowQr(instanceId: string) {
        setBusyId(instanceId);
        try {
            const res = await getQrCode(instanceId);
            if (res.success && res.data) {
                if (res.data.status === "open") {
                    toast.info("Essa instância já está conectada.");
                    router.refresh();
                } else {
                    setQr({ instanceId, image: res.data.qr });
                }
            } else if (!res.success) {
                toast.error(res.error);
            }
        } finally {
            setBusyId(null);
        }
    }

    async function handleRefresh(instanceId: string) {
        setBusyId(instanceId);
        try {
            await refreshConnectionState(instanceId);
            router.refresh();
        } finally {
            setBusyId(null);
        }
    }

    async function handleSync(instanceId: string) {
        setBusyId(instanceId);
        try {
            const res = await syncInstance(instanceId);
            if (res.success && res.data) {
                toast.success(`Sincronizado: ${res.data.chats} conversas, ${res.data.contacts} contatos.`);
            } else if (!res.success) {
                toast.error(res.error);
            }
            router.refresh();
        } finally {
            setBusyId(null);
        }
    }

    async function handleLogout(instanceId: string) {
        const ok = await confirm({
            title: "Desconectar instância",
            message: "Você precisará escanear o QR novamente para reconectar.",
            confirmLabel: "Desconectar",
            danger: true,
        });
        if (!ok) return;
        setBusyId(instanceId);
        try {
            await logoutInstance(instanceId);
            router.refresh();
        } finally {
            setBusyId(null);
        }
    }

    async function handleDeleteInstance(instanceId: string) {
        const ok = await confirm({
            title: "Remover instância",
            message: "As conversas sincronizadas dela serão apagadas do sistema.",
            confirmLabel: "Remover",
            danger: true,
        });
        if (!ok) return;
        setBusyId(instanceId);
        try {
            await deleteInstance(instanceId);
            router.refresh();
        } finally {
            setBusyId(null);
        }
    }

    async function handleRemoveServer(serverId: string) {
        const ok = await confirm({
            title: "Remover servidor",
            message: "O servidor e todas as suas instâncias serão removidos do sistema.",
            confirmLabel: "Remover",
            danger: true,
        });
        if (!ok) return;
        setBusyId(serverId);
        try {
            await removeServer(serverId);
            router.refresh();
        } finally {
            setBusyId(null);
        }
    }

    async function handleTest(serverId: string) {
        setBusyId(serverId);
        try {
            const res = await testServer(serverId);
            if (res.success && res.data) {
                toast.success(`Conexão OK. ${res.data.instances} instância(s) no servidor.`);
            } else if (!res.success) {
                toast.error(res.error);
            }
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="max-w-5xl mx-auto py-6">
            <div className="mb-2">
                <h1 className="text-3xl font-bold mb-1">WhatsApp</h1>
                <p className="text-muted-foreground">Conecte seus servidores e números de WhatsApp.</p>
            </div>
            <WhatsappTabs />

            {/* Add server */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-8">
                <div className="bg-muted/30 p-5 border-b border-border flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                        <Server size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Adicionar servidor Evolution</h2>
                        <p className="text-sm text-muted-foreground">Informe a URL e a chave (apikey) do seu servidor.</p>
                    </div>
                </div>
                <div className="p-5">
                    <form id="add-server-form" action={handleAddServer} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input
                            name="label"
                            placeholder="Apelido (opcional)"
                            className="bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <input
                            name="baseUrl"
                            placeholder="https://api.seuservidor.com.br"
                            required
                            className="md:col-span-2 bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <input
                            name="apiKey"
                            type="password"
                            placeholder="apikey global"
                            required
                            className="bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <div className="md:col-span-4 flex justify-end">
                            <button
                                type="submit"
                                disabled={adding}
                                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                Adicionar servidor
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Servers list */}
            {servers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                    Nenhum servidor cadastrado ainda. Adicione um acima para começar.
                </div>
            ) : (
                <div className="space-y-6">
                    {servers.map((server) => (
                        <div key={server.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                            <div className="p-5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                    <h3 className="font-bold truncate">{server.label || server.baseUrl}</h3>
                                    <p className="text-xs text-muted-foreground truncate">{server.baseUrl}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleTest(server.id)}
                                        disabled={busyId === server.id}
                                        className="flex items-center gap-2 bg-muted hover:bg-muted/70 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                    >
                                        {busyId === server.id ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                                        Testar
                                    </button>
                                    <button
                                        onClick={() => setImportServer({ id: server.id, label: server.label, baseUrl: server.baseUrl })}
                                        disabled={busyId === server.id}
                                        className="flex items-center gap-2 bg-muted hover:bg-muted/70 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                    >
                                        <Download size={14} /> Importar
                                    </button>
                                    <button
                                        onClick={() => setNewInstanceServer(server)}
                                        disabled={busyId === server.id}
                                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                    >
                                        <Plus size={14} /> Nova instância
                                    </button>
                                    <button
                                        onClick={() => setEditServer(server)}
                                        disabled={busyId === server.id}
                                        className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors disabled:opacity-50"
                                        title="Editar servidor (URL / apikey)"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleRemoveServer(server.id)}
                                        disabled={busyId === server.id}
                                        className="p-2 text-muted-foreground hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                                        title="Remover servidor"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {server.instances.length === 0 ? (
                                <div className="p-5 text-sm text-muted-foreground">
                                    Nenhuma instância. Clique em “Nova instância” e escaneie o QR Code.
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {server.instances.map((inst) => (
                                        <div key={inst.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                                                    <Smartphone size={18} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold truncate">
                                                            {inst.profileName || inst.instanceName}
                                                        </span>
                                                        <StatusBadge status={inst.connectionStatus} />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {inst.number ? `+${inst.number}` : inst.instanceName}
                                                        {inst.lastSyncAt
                                                            ? ` · sincronizado ${new Date(inst.lastSyncAt).toLocaleString("pt-BR")}`
                                                            : " · nunca sincronizado"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {inst.connectionStatus !== "open" && (
                                                    <button
                                                        onClick={() => handleShowQr(inst.id)}
                                                        disabled={busyId === inst.id}
                                                        className="flex items-center gap-1.5 bg-muted hover:bg-muted/70 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                                    >
                                                        <QrCode size={14} /> QR
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleRefresh(inst.id)}
                                                    disabled={busyId === inst.id}
                                                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors disabled:opacity-50"
                                                    title="Atualizar status"
                                                >
                                                    {busyId === inst.id ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <RefreshCw size={16} />
                                                    )}
                                                </button>
                                                {inst.connectionStatus === "open" && (
                                                    <button
                                                        onClick={() => handleSync(inst.id)}
                                                        disabled={busyId === inst.id}
                                                        className="flex items-center gap-1.5 bg-green-600/90 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                                    >
                                                        Sincronizar
                                                    </button>
                                                )}
                                                {inst.connectionStatus === "open" && (
                                                    <button
                                                        onClick={() => handleLogout(inst.id)}
                                                        disabled={busyId === inst.id}
                                                        className="p-2 text-muted-foreground hover:text-amber-400 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Desconectar"
                                                    >
                                                        <Power size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteInstance(inst.id)}
                                                    disabled={busyId === inst.id}
                                                    className="p-2 text-muted-foreground hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Remover instância"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {editServer && (
                <EditServerModal
                    server={editServer}
                    onClose={() => setEditServer(null)}
                    onSaved={(found) => {
                        const saved = editServer;
                        setEditServer(null);
                        router.refresh();
                        if (saved && found > 0) {
                            setImportServer({ id: saved.id, label: saved.label, baseUrl: saved.baseUrl });
                        }
                    }}
                />
            )}

            {importServer && (
                <ImportInstancesModal
                    server={importServer}
                    onClose={() => setImportServer(null)}
                    onImported={() => {
                        setImportServer(null);
                        router.refresh();
                    }}
                />
            )}

            {newInstanceServer && (
                <NewInstanceModal
                    server={newInstanceServer}
                    onClose={() => setNewInstanceServer(null)}
                    onCreated={(data) => {
                        setNewInstanceServer(null);
                        router.refresh();
                        setQr({ instanceId: data.instanceId, image: data.qr });
                    }}
                />
            )}

            {qr && <QrModal instanceId={qr.instanceId} image={qr.image} onClose={() => setQr(null)} onConnected={() => { setQr(null); router.refresh(); }} />}
        </div>
    );
}

function EditServerModal({
    server,
    onClose,
    onSaved,
}: {
    server: ServerItem;
    onClose: () => void;
    onSaved: (found: number) => void;
}) {
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);

    async function handleSubmit(formData: FormData) {
        setSaving(true);
        try {
            const res = await updateServer(server.id, formData);
            if (res.success) {
                onSaved(res.data?.found ?? 0);
            } else {
                toast.error(res.error);
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                    <X size={20} />
                </button>
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Pencil size={20} />
                    </div>
                    <h3 className="text-lg font-bold">Editar servidor</h3>
                </div>

                <form action={handleSubmit} className="space-y-3">
                    <div>
                        <label className="text-sm font-medium leading-none">Apelido</label>
                        <input
                            name="label"
                            defaultValue={server.label || ""}
                            placeholder="Apelido (opcional)"
                            className="mt-1.5 w-full bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium leading-none">URL</label>
                        <input
                            name="baseUrl"
                            defaultValue={server.baseUrl}
                            placeholder="https://api.seuservidor.com.br"
                            className="mt-1.5 w-full bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium leading-none">API Key global</label>
                        <input
                            name="apiKey"
                            type="password"
                            placeholder="Cole a API Key global (deixe em branco para manter)"
                            className="mt-1.5 w-full bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                            Use a chave <b>global</b> do servidor (não o token de uma instância) para ver e criar todas.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/70 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ImportInstancesModal({
    server,
    onClose,
    onImported,
}: {
    server: { id: string; label: string | null; baseUrl: string };
    onClose: () => void;
    onImported: () => void;
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [list, setList] = useState<FetchedInstance[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError(null);
            const res = await fetchServerInstances(server.id);
            if (!active) return;
            if (res.success && res.data) {
                setList(res.data.instances);
                setSelected(new Set(res.data.instances.filter((i) => !i.alreadyImported).map((i) => i.name)));
            } else if (!res.success) {
                setError(res.error);
            }
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [server.id]);

    function toggle(name: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }

    const selectable = list.filter((i) => !i.alreadyImported);
    const selectedCount = selectable.filter((i) => selected.has(i.name)).length;

    async function doImport() {
        const names = selectable.filter((i) => selected.has(i.name)).map((i) => i.name);
        if (names.length === 0) {
            onClose();
            return;
        }
        setImporting(true);
        try {
            const res = await importInstances(server.id, names);
            if (res.success) onImported();
            else toast.error(res.error);
        } finally {
            setImporting(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg p-6 relative flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                    <X size={20} />
                </button>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                        <Download size={22} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold">Importar instâncias</h3>
                        <p className="text-sm text-muted-foreground truncate">
                            Selecione os WhatsApps do servidor {server.label || server.baseUrl}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto -mx-1 px-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-10 text-muted-foreground">
                            <Loader2 className="animate-spin mr-2" size={18} /> Buscando instâncias...
                        </div>
                    ) : error ? (
                        <div className="py-8 text-center text-sm text-red-400">{error}</div>
                    ) : list.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Nenhuma instância encontrada neste servidor. Use “Nova instância” para criar uma.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {list.map((inst) => {
                                const checked = inst.alreadyImported || selected.has(inst.name);
                                return (
                                    <label
                                        key={inst.name}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                            inst.alreadyImported
                                                ? "border-border bg-muted/30 cursor-default"
                                                : "border-border hover:bg-muted/40 cursor-pointer"
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={inst.alreadyImported}
                                            onChange={() => toggle(inst.name)}
                                            className="w-4 h-4 accent-primary shrink-0"
                                        />
                                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                            <Smartphone size={16} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm truncate">
                                                    {inst.profileName || inst.name}
                                                </span>
                                                <StatusBadge status={inst.connectionStatus} />
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {inst.number ? `+${inst.number}` : inst.name}
                                            </p>
                                        </div>
                                        {inst.alreadyImported && (
                                            <span className="text-[11px] font-semibold text-green-500 flex items-center gap-1 shrink-0">
                                                <Check size={13} /> já importada
                                            </span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                {!loading && !error && (
                    <p className="text-[11px] text-muted-foreground mt-3">
                        Não apareceram todas as suas instâncias? A chave cadastrada pode ser o token de uma
                        instância. Use a <b>API Key global</b> do servidor (em Editar servidor) para ver todas.
                    </p>
                )}

                <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                        {selectedCount > 0 ? `${selectedCount} selecionada(s)` : "Nenhuma nova selecionada"}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/70 transition-colors"
                        >
                            Fechar
                        </button>
                        <button
                            onClick={doImport}
                            disabled={importing || selectedCount === 0}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {importing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            Importar selecionadas
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function NewInstanceModal({
    server,
    onClose,
    onCreated,
}: {
    server: ServerItem;
    onClose: () => void;
    onCreated: (data: { instanceId: string; qr: string | null }) => void;
}) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [creating, setCreating] = useState(false);
    const sanitized = name.trim().replace(/[^a-zA-Z0-9_-]/g, "_");

    async function submit() {
        if (!sanitized || creating) return;
        setCreating(true);
        try {
            const res = await createInstance(server.id, name);
            if (res.success && res.data) {
                onCreated(res.data);
            } else if (!res.success) {
                toast.error(res.error);
            }
        } finally {
            setCreating(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                    <X size={20} />
                </button>
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Smartphone size={22} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold">Nova instância</h3>
                        <p className="text-sm text-muted-foreground truncate">em {server.label || server.baseUrl}</p>
                    </div>
                </div>

                <label className="text-sm font-medium leading-none">Nome da instância</label>
                <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            submit();
                        }
                    }}
                    placeholder="ex.: vendas, suporte, meu-whatsapp"
                    className="mt-2 w-full bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <p className="text-xs text-muted-foreground mt-2 min-h-[16px]">
                    {sanitized && sanitized !== name.trim() ? (
                        <>
                            Será criada como <span className="font-mono text-foreground">{sanitized}</span>
                        </>
                    ) : (
                        "Um nome curto para identificar este número (letras, números, hífen e underline)."
                    )}
                </p>

                <div className="flex justify-end gap-2 mt-5">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/70 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={submit}
                        disabled={!sanitized || creating}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Criar e gerar QR
                    </button>
                </div>
            </div>
        </div>
    );
}

function QrModal({
    instanceId,
    image,
    onClose,
    onConnected,
}: {
    instanceId: string;
    image: string | null;
    onClose: () => void;
    onConnected: () => void;
}) {
    const [current, setCurrent] = useState<string | null>(image);
    const [status, setStatus] = useState<string>("connecting");
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        setCurrent(image);
    }, [image]);

    useEffect(() => {
        timer.current = setInterval(async () => {
            const res = await refreshConnectionState(instanceId);
            if (res.success && res.data) {
                setStatus(res.data.status);
                if (res.data.status === "open") {
                    if (timer.current) clearInterval(timer.current);
                    onConnected();
                }
            }
        }, 3500);
        return () => {
            if (timer.current) clearInterval(timer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instanceId]);

    async function refreshQr() {
        const res = await getQrCode(instanceId);
        if (res.success && res.data) {
            setStatus(res.data.status);
            if (res.data.status === "open") onConnected();
            else setCurrent(res.data.qr);
        }
    }

    const src = current
        ? current.startsWith("data:")
            ? current
            : `data:image/png;base64,${current}`
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-6 relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                    <X size={20} />
                </button>
                <h3 className="text-lg font-bold mb-1">Conectar WhatsApp</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Abra o WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> e escaneie o código.
                </p>
                <div className="bg-white rounded-xl p-3 flex items-center justify-center aspect-square">
                    {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="QR Code" className="w-full h-full object-contain" />
                    ) : (
                        <div className="text-center text-sm text-gray-500">
                            <Loader2 className="animate-spin mx-auto mb-2" />
                            Gerando QR Code...
                        </div>
                    )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        {status === "open" ? "Conectado!" : "Aguardando leitura..."}
                    </span>
                    <button onClick={refreshQr} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                        <RefreshCw size={13} /> Gerar novo QR
                    </button>
                </div>
            </div>
        </div>
    );
}
