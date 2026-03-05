
import { useState, useEffect, useRef } from "react";
import { X, Calendar, AlignLeft, Type, Clock, Loader2, Sparkles, Pencil, Keyboard, Mic, Square } from "lucide-react";
import { Task } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CreateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: any) => void;
    taskToEdit?: Task | null;
    startWithMagic?: boolean;
}

export default function CreateTaskModal({ isOpen, onClose, onSave, taskToEdit, startWithMagic = false }: CreateTaskModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isMagicMode, setIsMagicMode] = useState(false);

    // Form States
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [estimatedTime, setEstimatedTime] = useState("");

    const titleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            if (taskToEdit) {
                // Open in View Mode by default
                setIsEditing(false);
                setIsMagicMode(false);
                setTitle(taskToEdit.title);
                setDescription(taskToEdit.description || "");
                setDueDate(new Date(taskToEdit.dueDate).toISOString().split("T")[0]);
                setEstimatedTime(taskToEdit.estimatedTime || "");
            } else {
                // New Task
                setIsEditing(true);
                setTitle("");
                setDescription("");
                setEstimatedTime("");
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setDueDate(tomorrow.toISOString().split("T")[0]);

                if (startWithMagic) {
                    setIsMagicMode(true);
                } else {
                    setIsMagicMode(false);
                    setTimeout(() => titleInputRef.current?.focus(), 100);
                }
            }
        }
    }, [isOpen, taskToEdit, startWithMagic]);

    // Handle AI File Processing
    const processFile = async (file: File) => {
        // Accept image OR audio
        if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) return;

        setIsAnalyzing(true);
        // Ensure we are in edit mode to show results
        setIsEditing(true);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/ai/generate-task", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (data.error) {
                alert("Erro na IA: " + (data.details || data.error));
            } else {
                handleAiData(data);
                setIsMagicMode(false); // Reveal form
            }
        } catch (error) {
            console.error(error);
            alert("Falha ao analisar imagem");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Global Paste Listener
    useEffect(() => {
        if (!isOpen) return;

        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault(); // Prevent pasting into inputs
                        processFile(file);
                        return;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !dueDate) return;

        onSave({
            title,
            description,
            dueDate: new Date(dueDate).toISOString(),
            status: taskToEdit ? undefined : "TODO", // Don't reset status on edit
            estimatedTime,
        });

        if (!taskToEdit) {
            handleClose();
        } else {
            setIsEditing(false); // Go back to view mode after save
        }
    };

    const handleClose = () => {
        setTitle("");
        setDescription("");
        setEstimatedTime("");
        setIsEditing(false);
        setIsMagicMode(false);
        onClose();
    };

    const handleAiData = (data: any) => {
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
        if (data.estimatedTime) setEstimatedTime(data.estimatedTime);
        if (data.dueDate) setDueDate(data.dueDate);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
                className={`
                    bg-card w-full rounded-2xl shadow-2xl border border-border flex flex-col animate-in fade-in zoom-in duration-200 relative overflow-hidden
                    ${isEditing && !isMagicMode ? 'max-w-md' : 'max-w-5xl'} transition-all
                `}
            >
                {/* AI Loading Overlay */}
                {isAnalyzing && (
                    <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-50 flex flex-col items-center justify-center text-primary animate-in fade-in">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <Loader2 size={60} className="animate-spin mb-6 relative z-10 text-primary" />
                        </div>
                        <p className="font-bold text-2xl mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                            Criando Mágica...
                        </p>
                        <p className="text-muted-foreground">Lendo seu print e organizando tudo</p>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between p-4 px-6 border-b border-border/50">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        {isMagicMode ? (
                            <span className="flex items-center gap-2 text-purple-500">
                                <Sparkles size={20} />
                                Tarefa Mágica
                            </span>
                        ) : (
                            isEditing
                                ? (taskToEdit ? "Editar Tarefa" : "Nova Tarefa")
                                : "Detalhes da Tarefa"
                        )}
                    </h2>
                    <div className="flex items-center gap-2">
                        {!isEditing && !isMagicMode && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                                <Pencil size={14} /> Editar
                            </button>
                        )}
                        {isEditing && !taskToEdit && !isMagicMode && (
                            <MagicUpload onFileSelect={processFile} isAnalyzing={isAnalyzing} />
                        )}
                        <button
                            onClick={handleClose}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Magic Mode Initial State */}
                {isMagicMode && (
                    <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px] animate-in slide-in-from-bottom-5">
                        <div className="flex items-center gap-6">
                            {/* Visual Paste Target */}
                            <div className="group relative">
                                <div className="p-6 bg-muted/30 rounded-2xl border-2 border-dashed border-border mb-2 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center gap-2"
                                    onClick={() => document.querySelector('input[type="file"]')?.parentElement?.querySelector('button')?.click()}
                                >
                                    <Sparkles size={32} className="text-purple-500" />
                                    <span className="text-xs font-bold text-muted-foreground uppercase">Imagem</span>
                                </div>
                            </div>

                            <div className="h-12 w-px bg-border/50" />

                            {/* Audio Recorder */}
                            <AudioRecorder onRecordingComplete={processFile} />
                        </div>

                        <div className="space-y-2 max-w-sm mx-auto">
                            <h3 className="text-2xl font-bold">Como quer criar?</h3>
                            <p className="text-muted-foreground text-sm">
                                <span className="font-bold text-foreground">Cole um print (Ctrl+V)</span> ou <span className="font-bold text-foreground">grave um áudio</span> explicando o que precisa ser feito.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <MagicUpload onFileSelect={processFile} isAnalyzing={isAnalyzing} label="Carregar Arquivo" icon={<Sparkles size={16} />} />
                        </div>

                        <button
                            onClick={() => setIsMagicMode(false)}
                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 mt-8"
                        >
                            Prefiro digitar manualmente
                        </button>
                    </div>
                )}

                {/* View Mode Content */}
                {!isEditing && !isMagicMode && (
                    <div className="p-8">
                        {/* Title - Large & Featured */}
                        <h1 className="text-3xl font-bold text-foreground mb-6 leading-tight">
                            {title}
                        </h1>

                        {/* Metadata Row - Compact & Side-by-Side */}
                        <div className="flex flex-wrap items-center gap-4 mb-8 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
                                <Calendar size={16} />
                                <span className="font-medium text-foreground">
                                    {dueDate && format(new Date(dueDate), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                                </span>
                            </div>

                            {estimatedTime && (
                                <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
                                    <Clock size={16} />
                                    <span className="font-medium text-foreground">{estimatedTime}</span>
                                </div>
                            )}
                        </div>

                        {/* Description - Highlighted & Readable */}
                        <div className="bg-muted/30 rounded-xl p-6 border border-border/50 min-h-[120px] max-h-[65vh] overflow-y-auto">
                            {description ? (
                                <p className="text-lg leading-relaxed whitespace-pre-wrap text-foreground/90 font-medium">
                                    {description}
                                </p>
                            ) : (
                                <p className="text-muted-foreground italic opacity-50">Sem descrição.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Edit Mode Form */}
                {isEditing && !isMagicMode && (
                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        {/* Paste Hint */}
                        {!taskToEdit && (
                            <div className="flex items-center justify-center gap-2 text-[10px] uppercase font-bold text-muted-foreground/50 border border-dashed border-border rounded-lg p-2 bg-muted/20">
                                <Keyboard size={12} />
                                <span>Pressione <span className="text-foreground">Ctrl + V</span> para colar um print</span>
                            </div>
                        )}

                        {/* Title */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Type size={14} /> Título
                            </label>
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="O que precisa ser feito?"
                                className="w-full bg-muted/50 border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50 transition-all font-medium"
                                required
                            />
                        </div>

                        {/* Date & Time Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar size={14} /> Data Limite
                                </label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full bg-muted/50 border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground [color-scheme:dark] transition-all"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock size={14} /> Tempo
                                </label>
                                <select
                                    value={estimatedTime}
                                    onChange={(e) => setEstimatedTime(e.target.value)}
                                    className="w-full bg-muted/50 border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground transition-all appearance-none"
                                >
                                    <option value="" className="text-black dark:text-white bg-white dark:bg-slate-950">Selecione...</option>
                                    <option value="Rápido" className="text-black dark:text-white bg-white dark:bg-slate-950">Rápido ⚡</option>
                                    <option value="Mediano" className="text-black dark:text-white bg-white dark:bg-slate-950">Mediano ⚖️</option>
                                    <option value="Demorado" className="text-black dark:text-white bg-white dark:bg-slate-950">Demorado 🐌</option>
                                </select>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <AlignLeft size={14} /> Descrição
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detalhes adicionais..."
                                rows={5}
                                className="w-full bg-muted/50 border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50 resize-none transition-all"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={taskToEdit ? () => setIsEditing(false) : handleClose}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                            >
                                {taskToEdit ? "Salvar" : "Criar Tarefa"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}


function AudioRecorder({ onRecordingComplete }: { onRecordingComplete: (file: File) => void }) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const file = new File([blob], "recording.webm", { type: 'audio/webm' });
                onRecordingComplete(file);
                stream.getTracks().forEach(track => track.stop()); // Stop mic usage
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Não foi possível acessar o microfone. Verifique as permissões.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`
                    p-6 rounded-full transition-all border-2 cursor-pointer
                    ${isRecording
                        ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse hover:bg-red-500/20'
                        : 'bg-muted/30 border-dashed border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    }
                `}
                title={isRecording ? "Parar Gravação" : "Gravar Áudio"}
            >
                {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={32} />}
            </button>
            <span className="text-xs font-bold text-muted-foreground uppercase mt-2 block">
                {isRecording ? "Gravando..." : "Gravar"}
            </span>
        </div>
    );
}

function MagicUpload({ onFileSelect, isAnalyzing, label, icon }: { onFileSelect: (file: File) => void, isAnalyzing: boolean, label?: string, icon?: React.ReactNode }) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onFileSelect(file);
    };

    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="
                    flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider
                    bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:opacity-90 transition-all
                    disabled:opacity-50 disabled:cursor-wait shadow-[0_0_15px_rgba(168,85,247,0.4)]
                "
            >
                {isAnalyzing ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Analisando...
                    </>
                ) : (
                    <>
                        {icon || <Sparkles size={16} />}
                        {label || "Mágica com IA"}
                    </>
                )}
            </button>
        </>
    );
}
