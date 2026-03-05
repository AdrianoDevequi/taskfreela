"use client";

import { saveSettings } from "@/app/actions/settings";
import { useState } from "react";
import { Loader2, Save, Wifi, Bell } from "lucide-react";

export function EvolutionSettingsForm({ settings }: { settings: any }) {
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    async function handleSubmit(formData: FormData) {
        setIsSaving(true);
        try {
            await saveSettings(formData);
            alert("Configurações salvas com sucesso!");
        } catch (error) {
            alert("Erro ao salvar configurações.");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-muted/30 p-6 border-b border-border flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                    <Wifi size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold">Conexão Evolution API</h2>
                    <p className="text-sm text-muted-foreground">Configure a integração com o WhatsApp para notificações.</p>
                </div>
            </div>

            <div className="p-6">
                <form action={handleSubmit} className="space-y-6 max-w-2xl">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">
                                    API Base URL
                                </label>
                                <input
                                    name="apiUrl"
                                    placeholder="https://api.evolution.com"
                                    defaultValue={settings?.apiUrl}
                                    className="w-full bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                    required
                                />
                                <p className="text-[10px] text-muted-foreground">URL da sua instância Evolution (sem a barra final)</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">
                                    Global API Key
                                </label>
                                <input
                                    name="apiKey"
                                    type="password"
                                    placeholder="Sua API Key Global"
                                    defaultValue={settings?.apiKey}
                                    className="w-full bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">
                                    Nome da Instância
                                </label>
                                <input
                                    name="instanceName"
                                    placeholder="Ex: MinhaEmpresa"
                                    defaultValue={settings?.instanceName}
                                    className="w-full bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                    required
                                />
                                <p className="text-[10px] text-muted-foreground">Nome exato da instância criada na Evolution</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">
                                    WhatsApp para Notificação
                                </label>
                                <input
                                    name="notificationPhone"
                                    placeholder="5511999999999"
                                    defaultValue={settings?.notificationPhone}
                                    className="w-full bg-muted/50 border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                                    required
                                />
                                <p className="text-[10px] text-muted-foreground">Número com DDI e DDD (apenas números)</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={async () => {
                                setIsTesting(true);
                                try {
                                    const { sendTestMessage } = await import("@/app/actions/settings");
                                    const result = await sendTestMessage();
                                    if (result.success) {
                                        alert("✅ Mensagem de teste enviada! Verifique seu WhatsApp.");
                                    } else {
                                        alert("❌ Falha no teste: " + (result.error || "Erro desconhecido"));
                                    }
                                } catch (error) {
                                    alert("❌ Erro ao enviar teste.");
                                } finally {
                                    setIsTesting(false);
                                }
                            }}
                            disabled={isTesting || isSaving}
                            className="
                                flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-green-600/20 transition-all active:scale-95
                                disabled:opacity-50 disabled:cursor-wait
                            "
                        >
                            {isTesting ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Wifi size={18} />
                            )}
                            Testar Conexão
                        </button>

                        <button
                            type="button"
                            onClick={async () => {
                                if (!confirm("Tem certeza que deseja disparar as notificações de atraso agora? Isso pode levar algum tempo.")) return;

                                setIsTesting(true); // Reusing state for loading
                                try {
                                    const { triggerManualNotifications } = await import("@/app/actions/settings");
                                    const result = await triggerManualNotifications();
                                    if (result.success) {
                                        alert(`✅ Disparo concluído! ${result.count} mensagens enviadas.`);
                                    } else {
                                        alert("❌ Falha no disparo: " + (result.error || "Erro desconhecido"));
                                    }
                                } catch (error) {
                                    alert("❌ Erro ao disparar notificações.");
                                } finally {
                                    setIsTesting(false);
                                }
                            }}
                            disabled={isTesting || isSaving}
                            className="
                                flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-amber-600/20 transition-all active:scale-95
                                disabled:opacity-50 disabled:cursor-wait
                            "
                        >
                            <Bell size={18} />
                            Disparar Atrasos
                        </button>

                        <button
                            type="submit"
                            disabled={isSaving || isTesting}
                            className="
                                flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95
                                disabled:opacity-50 disabled:cursor-wait
                            "
                        >
                            {isSaving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Save size={18} />
                            )}
                            Salvar Configurações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
