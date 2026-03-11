"use client";

import { useState, useEffect } from "react";
import { updateNotificationPreferences } from "@/app/lib/actions";
import { Bell, Loader2, MonitorSmartphone } from "lucide-react";

interface NotificationSettingsFormProps {
    user: {
        notifyDailySummary: boolean;
        notifyNewTasks: boolean;
        notifyOverdueTasks: boolean;
    };
}

export function NotificationSettingsForm({ user }: NotificationSettingsFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    
    const [preferences, setPreferences] = useState({
        notifyDailySummary: user.notifyDailySummary,
        notifyNewTasks: user.notifyNewTasks,
        notifyOverdueTasks: user.notifyOverdueTasks
    });

    const [isPushEnabled, setIsPushEnabled] = useState(false);
    const [isPushLoading, setIsPushLoading] = useState(true);

    useEffect(() => {
        // Check if push is supported and if already subscribed
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(reg => {
                reg.pushManager.getSubscription().then(sub => {
                    if (sub) setIsPushEnabled(true);
                    setIsPushLoading(false);
                }).catch(() => setIsPushLoading(false));
            }).catch(() => setIsPushLoading(false));
        } else {
            setIsPushLoading(false); // Not supported
        }
    }, []);

    // Helper to convert VAPID key
    function urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
      
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
      
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    const handlePushToggle = async () => {
        if (!('serviceWorker' in navigator && 'PushManager' in window)) {
            setMessage({ text: "Push Notifications não são suportadas neste navegador.", type: "error" });
            return;
        }

        setIsPushLoading(true);
        setMessage({ text: "", type: "" });

        if (isPushEnabled) {
            // Unsubscribe
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                    await sub.unsubscribe();
                    setIsPushEnabled(false);
                    setMessage({ text: "Notificações do navegador desativadas neste dispositivo.", type: "success" });
                }
            } catch (error) {
                console.error("Error unsubscribing", error);
                setMessage({ text: "Erro ao desativar notificações do navegador.", type: "error" });
            } finally {
                setIsPushLoading(false);
            }
            return;
        }

        // Subscribe
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setIsPushLoading(false);
                setMessage({ text: "Permissão de notificação negada no navegador.", type: "error" });
                setIsPushEnabled(false);
                return;
            }

            const reg = await navigator.serviceWorker.ready;
            
            // Get public key from env directly if available, otherwise fallback (we'll fetch if needed, but here we can inject via NEXT_PUBLIC)
            const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BECbbGAQXAFRkgtG8k3nWhXqZxzf1R-0LnUz_dMgAxgjAo6UFqt1smYYIrHxBI3y5UbuK4iU0fhl2AbYGJI-UFY";
            
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });

            // Send to our backend
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub)
            });

            if (!response.ok) throw new Error("Failed to save subscription");

            setIsPushEnabled(true);
            setMessage({ text: "Dispositivo registrado para receber notificações com sucesso!", type: "success" });
        } catch (error) {
            console.error("Push subscription error:", error);
            setMessage({ text: "Erro ao ativar notificações do navegador. Tente limpar os dados do site.", type: "error" });
        } finally {
            setIsPushLoading(false);
        }
    };

    const handleToggle = async (field: keyof typeof preferences) => {
        setIsLoading(true);
        setMessage({ text: "", type: "" });

        const newValue = !preferences[field];
        
        // Optimistic update
        const newPreferences = { ...preferences, [field]: newValue };
        setPreferences(newPreferences);

        try {
            const result = await updateNotificationPreferences(newPreferences);
            
            if (result?.error) {
                // Revert on error
                setPreferences(preferences);
                setMessage({ text: result.error, type: "error" });
            } else {
                setMessage({ text: "Preferências salvas com sucesso!", type: "success" });
                // Hide success message after 3 seconds
                setTimeout(() => setMessage({ text: "", type: "" }), 3000);
            }
        } catch (error) {
            // Revert on error
            setPreferences(preferences);
            setMessage({ text: "Erro ao salvar preferências.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <MonitorSmartphone size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Notificações Nativas do Aparelho</h2>
                        <p className="text-sm text-muted-foreground">Receba alertas diretos na tela do seu celular ou computador.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <ToggleItem 
                        title="Ativar PWA Web Push"
                        description="Habilita este dispositivo atual para receber os alertas pop-up do sistema."
                        checked={isPushEnabled}
                        onChange={handlePushToggle}
                        disabled={isPushLoading}
                    />
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-500/10 text-green-500 rounded-lg group-hover:bg-green-500 group-hover:text-white transition-colors">
                        <Bell size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Notificações do WhatsApp</h2>
                        <p className="text-sm text-muted-foreground">Escolha quais alertas curtos você deseja receber no seu número.</p>
                    </div>
                </div>

            <div className="space-y-6">
                <ToggleItem 
                    title="Resumo Diário de Tarefas"
                    description="Receba uma mensagem todas as manhãs com o resumo do que você precisa fazer no dia."
                    checked={preferences.notifyDailySummary}
                    onChange={() => handleToggle('notifyDailySummary')}
                    disabled={isLoading}
                />
                
                <ToggleItem 
                    title="Novas Tarefas Atribuídas"
                    description="Seja avisado instantaneamente quando alguém atribuir uma nova tarefa para você."
                    checked={preferences.notifyNewTasks}
                    onChange={() => handleToggle('notifyNewTasks')}
                    disabled={isLoading}
                />

                <ToggleItem 
                    title="Alertas de Tarefas Atrasadas"
                    description="Receba lembretes sobre tarefas que já passaram da data de entrega."
                    checked={preferences.notifyOverdueTasks}
                    onChange={() => handleToggle('notifyOverdueTasks')}
                    disabled={isLoading}
                />
            </div>

            {message.text && (
                <div className={`mt-6 p-4 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'} flex items-start gap-3`}>
                    <p>{message.text}</p>
                </div>
            )}
            </div>
        </div>
    );
}

function ToggleItem({ title, description, checked, onChange, disabled }: { title: string, description: string, checked: boolean, onChange: () => void, disabled: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
            <div>
                <p className="font-medium text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={onChange}
                disabled={disabled}
                className={`
                    relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                    transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                    ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <span className="sr-only">Toggle {title}</span>
                <span
                    aria-hidden="true"
                    className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                        transition duration-200 ease-in-out
                        ${checked ? 'translate-x-5' : 'translate-x-0'}
                    `}
                />
            </button>
        </div>
    );
}
