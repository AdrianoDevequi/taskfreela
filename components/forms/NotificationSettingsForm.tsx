"use client";

import { useState } from "react";
import { updateNotificationPreferences } from "@/app/lib/actions";
import { Bell, Loader2 } from "lucide-react";

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
    
    // Store local state for optimistic UI updates
    const [preferences, setPreferences] = useState({
        notifyDailySummary: user.notifyDailySummary,
        notifyNewTasks: user.notifyNewTasks,
        notifyOverdueTasks: user.notifyOverdueTasks
    });

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
        <div className="bg-card border border-border rounded-xl p-6 relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Bell size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold">Notificações do WhatsApp</h2>
                    <p className="text-sm text-muted-foreground">Escolha quais alertas você deseja receber no seu número.</p>
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
