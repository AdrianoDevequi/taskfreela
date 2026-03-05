
import { useState, useEffect, useRef } from "react";
import { X, Loader2, Sparkles, Pencil, Save } from "lucide-react";

interface Reminder {
    id: string;
    content: string;
    isCompleted: boolean;
    createdAt: string;
}

interface ReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (content: string) => Promise<void>;
    reminderToEdit?: Reminder | null;
}

export default function ReminderModal({ isOpen, onClose, onSave, reminderToEdit }: ReminderModalProps) {
    const [content, setContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setContent(reminderToEdit ? reminderToEdit.content : "");
            // Focus textarea after animation
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    }, [isOpen, reminderToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSaving(true);
        try {
            await onSave(content);
            // Close handled by parent or useEffect, but we'll assume success/close call in parent
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
                className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col animate-in fade-in zoom-in duration-200 relative overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 px-6 border-b border-border/50">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        {reminderToEdit ? (
                            <>
                                <Pencil size={18} className="text-primary" />
                                Editar Lembrete
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} className="text-primary" />
                                Novo Lembrete
                            </>
                        )}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="O que você precisa lembrar?"
                            rows={5}
                            className="w-full bg-muted/50 border border-input rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50 resize-none transition-all"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            disabled={isSaving}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !content.trim()}
                            className="
                                flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
                        >
                            {isSaving ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            {reminderToEdit ? "Salvar Alterações" : "Criar Lembrete"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
