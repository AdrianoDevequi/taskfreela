"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Square, Trash2, CheckCircle, Circle, Loader2, Sparkles, Plus, Pencil } from "lucide-react";
import MobileFAB from "@/components/MobileFAB";
import ReminderModal from "@/components/ReminderModal";

interface Reminder {
    id: string;
    content: string;
    isCompleted: boolean;
    createdAt: string;
}

export default function RemindersPage() {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

    useEffect(() => {
        fetchReminders();
    }, []);

    const fetchReminders = async () => {
        try {
            const res = await fetch("/api/reminders");
            const data = await res.json();
            setReminders(data);
        } catch (error) {
            console.error("Failed to fetch reminders", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleComplete = async (id: string, currentStatus: boolean) => {
        // Optimistic update
        setReminders(prev => prev.map(r => r.id === id ? { ...r, isCompleted: !currentStatus } : r));

        try {
            await fetch("/api/reminders", {
                method: "PATCH",
                body: JSON.stringify({ id, isCompleted: !currentStatus }),
            });
        } catch (error) {
            console.error("Failed to update reminder");
            fetchReminders(); // Revert on error
        }
    };

    const deleteReminder = async (id: string) => {
        setReminders(prev => prev.filter(r => r.id !== id));
        try {
            await fetch(`/api/reminders?id=${id}`, { method: "DELETE" });
        } catch (error) {
            console.error("Failed to delete reminder");
            fetchReminders();
        }
    };

    const handleSaveReminder = async (content: string) => {
        try {
            if (editingReminder) {
                // Optimistic update
                setReminders(prev => prev.map(r => r.id === editingReminder.id ? { ...r, content } : r));

                await fetch("/api/reminders", {
                    method: "PATCH",
                    body: JSON.stringify({ id: editingReminder.id, content }),
                });
            } else {
                const res = await fetch("/api/reminders", {
                    method: "POST",
                    body: JSON.stringify({ content }),
                });
                const newReminder = await res.json();
                setReminders(prev => [newReminder, ...prev]);
            }
            setIsModalOpen(false);
            setEditingReminder(null);
            fetchReminders(); // Sync to be sure
        } catch (error) {
            console.error("Failed to save reminder");
            alert("Erro ao salvar lembrete");
            fetchReminders();
        }
    };

    const openNewReminder = () => {
        setEditingReminder(null);
        setIsModalOpen(true);
    };

    const openEditReminder = (reminder: Reminder) => {
        setEditingReminder(reminder);
        setIsModalOpen(true);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const file = new File([blob], "audio.webm", { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                processAudio(file);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            alert("Erro ao acessar microfone. Verifique permissões.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const processAudio = async (file: File) => {
        setIsProcessing(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/ai/generate-reminders", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (data.reminders && Array.isArray(data.reminders)) {
                // Add each reminder sequentially
                for (const content of data.reminders) {
                    await fetch("/api/reminders", {
                        method: "POST",
                        body: JSON.stringify({ content }),
                    });
                }
                fetchReminders();
            }
        } catch (error) {
            alert("Erro ao processar áudio.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Lembretes</h1>
                    <p className="text-muted-foreground">Fale tudo o que precisa lembrar e a IA organiza para você.</p>
                </div>

                <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessing}
                    className={`
                        hidden md:flex items-center gap-3 px-6 py-3 rounded-full font-bold transition-all shadow-lg
                        ${isRecording
                            ? 'bg-red-500 text-white animate-pulse shadow-red-500/30'
                            : 'bg-primary text-white hover:bg-primary/90 shadow-primary/30'
                        }
                        ${isProcessing ? 'opacity-70 cursor-wait' : ''}
                    `}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="animate-spin" />
                            Processando...
                        </>
                    ) : isRecording ? (
                        <>
                            <Square fill="currentColor" size={20} />
                            Parar Gravação
                        </>
                    ) : (
                        <>
                            <Mic size={20} />
                            Gravar Lembretes
                        </>
                    )}
                </button>

                <MobileFAB
                    mainAction={{
                        label: isRecording ? "Parar" : "Gravar",
                        icon: isProcessing ? <Loader2 className="animate-spin" /> : isRecording ? <Square fill="currentColor" size={24} /> : <Mic size={24} />,
                        onClick: isRecording ? stopRecording : startRecording,
                        color: isRecording ? "bg-red-500 animate-pulse" : "bg-primary"
                    }}
                />
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-muted-foreground" size={40} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* Add New Card (Manual) */}
                    <div
                        onClick={openNewReminder}
                        className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50 hover:border-primary/50 hover:text-primary transition-all h-[140px] gap-2 group"
                    >
                        <div className="p-3 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                            <Plus size={24} />
                        </div>
                        <span className="font-medium text-sm">Novo Lembrete</span>
                    </div>

                    {reminders.map((reminder) => (
                        <div
                            key={reminder.id}
                            className={`
                                group relative p-6 rounded-xl border transition-all duration-300
                                ${reminder.isCompleted
                                    ? 'bg-muted/30 border-border/50 opacity-60'
                                    : 'bg-card border-border hover:shadow-lg hover:border-primary/50'
                                }
                            `}
                        >
                            <div className="flex items-start gap-3">
                                <button
                                    onClick={() => toggleComplete(reminder.id, reminder.isCompleted)}
                                    className={`mt-1 flex-shrink-0 transition-colors ${reminder.isCompleted ? 'text-green-500' : 'text-muted-foreground hover:text-primary'}`}
                                >
                                    {reminder.isCompleted ? <CheckCircle size={20} /> : <Circle size={20} />}
                                </button>

                                <p className={`flex-1 text-base font-medium leading-tight ${reminder.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                    {reminder.content}
                                </p>
                            </div>

                            <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => openEditReminder(reminder)}
                                    className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10"
                                    title="Editar"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => deleteReminder(reminder.id)}
                                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="absolute bottom-4 right-4 text-[10px] text-muted-foreground opacity-50 font-mono">
                                {new Date(reminder.createdAt).toLocaleDateString('pt-BR')}
                            </div>
                        </div>
                    ))}

                    {reminders.length === 0 && !isProcessing && (
                        <div className="col-span-full py-20 text-center text-muted-foreground space-y-4">
                            <div className="bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Sparkles size={32} className="text-muted-foreground/50" />
                            </div>
                            <p className="text-lg font-medium">Nenhum lembrete ainda.</p>
                            <p className="text-sm">Clique em "Gravar Lembretes" e fale tudo o que precisa.</p>
                        </div>
                    )}
                </div>
            )}

            <ReminderModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveReminder}
                reminderToEdit={editingReminder}
            />
        </div>
    );
}
