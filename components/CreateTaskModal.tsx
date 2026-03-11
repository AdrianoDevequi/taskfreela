import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSimpleMode } from "@/app/context/SimpleModeContext";
import { X, Calendar, AlignLeft, Type, Clock, Loader2, Sparkles, Pencil, Keyboard, Mic, Square, Briefcase, Users, MessageSquare, Send, Paperclip, Repeat, Info } from "lucide-react";
import { Task } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CreateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: any) => void;
    taskToEdit?: Task | null;
    startWithMagic?: boolean;
}

export default function CreateTaskModal({ isOpen, onClose, onSave, taskToEdit, startWithMagic = false }: CreateTaskModalProps) {
    const { data: session } = useSession();
    const { isSimpleMode } = useSimpleMode();
    const [isEditing, setIsEditing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isMagicMode, setIsMagicMode] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    // Form States
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [estimatedTime, setEstimatedTime] = useState("");
    const [isMandatory, setIsMandatory] = useState(false);
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrencePattern, setRecurrencePattern] = useState("DAILY");
    const [recurrenceDays, setRecurrenceDays] = useState("");
    const [projectId, setProjectId] = useState("");
    const [availableProjects, setAvailableProjects] = useState<{id: string, name: string}[]>([]);
    
    // Assignee State
    const [assignedToId, setAssignedToId] = useState("");
    const [teamMembers, setTeamMembers] = useState<{id: string, name: string, email: string}[]>([]);

    // Comments State
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    useEffect(() => {
        // Fetch projects to populate the select dropdown
        fetch("/api/projects").then(res => res.json()).then(data => {
            if (Array.isArray(data)) setAvailableProjects(data);
        }).catch(err => console.error(err));

        // Fetch team members to populate the assignee dropdown
        fetch("/api/team")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    // Filter out the current user to avoid duplicate (since "Atribuir a mim" is always present as an option)
                    // We check both ID and Email to be safe depending on how next-auth session is populated
                    const currentUserEmail = session?.user?.email;
                    const currentUserId = (session?.user as any)?.id;
                    const filtered = data.filter((member: any) => member.id !== currentUserId && member.email !== currentUserEmail);
                    setTeamMembers(filtered);
                }
            })
            .catch(err => console.error(err));
    }, [session]);

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
                setIsMandatory(taskToEdit.isMandatory || false);
                setIsRecurring(taskToEdit.isRecurring || false);
                setRecurrencePattern(taskToEdit.recurrencePattern || "DAILY");
                setRecurrenceDays(taskToEdit.recurrenceDays || "");
                setProjectId(taskToEdit.projectId || "");
                if (taskToEdit.id) {
                    fetchComments(taskToEdit.id.toString());
                }
            } else {
                // New Task
                setIsEditing(true);
                setDescription("");
                setEstimatedTime("");
                setIsMandatory(false);
                setIsRecurring(false);
                setRecurrencePattern("DAILY");
                setRecurrenceDays("");
                setProjectId("");
                setAssignedToId("");
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
            // Ignore paste if we are focused inside an input or textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

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

    const fetchComments = async (taskId: string) => {
        try {
            const res = await fetch(`/api/tasks/comments?taskId=${taskId}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setComments(data);
            }
        } catch (error) {
            console.error("Failed to fetch comments", error);
        }
    };

    const submitComment = async () => {
        if (!newComment.trim() || !taskToEdit?.id) return;
        setIsSubmittingComment(true);
        try {
            const res = await fetch("/api/tasks/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    taskId: taskToEdit.id,
                    content: newComment
                })
            });
            const data = await res.json();
            if (data.success && data.comment) {
                setComments(prev => [...prev, data.comment]);
                setNewComment("");
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar comentário");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDescriptionPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault(); // Stop normal paste
                    await uploadImageToDescription(file);
                    return;
                }
            }
        }
    };

    const uploadImageToDescription = async (file: File, options?: { raw?: boolean }) => {
        setIsUploadingImage(true);
        const formData = new FormData();
        formData.append("file", file);
        if (options?.raw) formData.append("raw", "true");

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (data.url) {
                const isImage = file.type.startsWith('image/');
                const markdownImage = isImage ? `\n![imagem](${data.url})\n` : `\n[📥 ${file.name}](${data.url})\n`;
                const textarea = document.getElementById('task-description-textarea') as HTMLTextAreaElement;
                
                if (textarea) {
                    const startPos = textarea.selectionStart;
                    const endPos = textarea.selectionEnd;
                    const newDescription = description.substring(0, startPos)
                        + markdownImage
                        + description.substring(endPos, description.length);
                    setDescription(newDescription);
                    
                    // Reset focus and cursor position after a short delay to allow React to update
                    setTimeout(() => {
                        textarea.focus();
                        textarea.setSelectionRange(startPos + markdownImage.length, startPos + markdownImage.length);
                    }, 50);
                } else {
                    setDescription(prev => prev + markdownImage);
                }
            } else {
                alert("Erro ao fazer upload da imagem");
            }
        } catch (error) {
            console.error(error);
            alert("Falha no upload da imagem");
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await uploadImageToDescription(file, { raw: true });
        }
        if (e.target) e.target.value = ''; // Reset input
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;
        if (!isRecurring && !dueDate) return; // due date is required for non-recurring only

        let finalDueDate = dueDate;

        if (isRecurring) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const formatDateLocal = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            if (recurrencePattern === "DAILY") {
                const next = new Date(today);
                next.setDate(next.getDate() + 1);
                finalDueDate = formatDateLocal(next);
            } else if (recurrencePattern === "WEEKLY") {
                const next = new Date(today);
                next.setDate(next.getDate() + 7);
                finalDueDate = formatDateLocal(next);
            } else if (recurrencePattern === "MONTHLY") {
                const next = new Date(today);
                next.setMonth(next.getMonth() + 1);
                finalDueDate = formatDateLocal(next);
            } else if (recurrencePattern === "CUSTOM_DAYS" && recurrenceDays) {
                const selectedDays = recurrenceDays.split(',').map(Number);
                if (selectedDays.length > 0) {
                    let daysToAdd = 1;
                    while (daysToAdd <= 7) {
                        const checkDate = new Date(today);
                        checkDate.setDate(checkDate.getDate() + daysToAdd);
                        if (selectedDays.includes(checkDate.getDay())) {
                            finalDueDate = formatDateLocal(checkDate);
                            break;
                        }
                        daysToAdd++;
                    }
                } else {
                    const next = new Date(today);
                    next.setDate(next.getDate() + 1);
                    finalDueDate = formatDateLocal(next);
                }
            }
        }

        // In Simple Mode, force the assignee to be the current user
        const currentUserId = (session?.user as any)?.id;
        const finalAssigneeId = isSimpleMode ? currentUserId : (assignedToId || null);
        const finalProjectId = isSimpleMode ? null : (projectId || null);

        onSave({
            title,
            description,
            // Appending T12:00:00 forces noon in local time. 
            // This prevents Date parsing from defaulting to UTC midnight, 
            // which becomes 21:00 on the previous day in Brazil (UTC-3).
            dueDate: finalDueDate ? new Date(`${finalDueDate}T12:00:00`).toISOString() : new Date().toISOString(),
            status: taskToEdit ? undefined : "TODO", // Don't reset status on edit
            estimatedTime,
            isMandatory: isRecurring ? true : isMandatory,
            isRecurring,
            recurrencePattern: isRecurring ? recurrencePattern : null,
            recurrenceDays: (isRecurring && recurrencePattern === 'CUSTOM_DAYS') ? recurrenceDays : null,
            projectId: finalProjectId,
            assignedToId: finalAssigneeId,
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
        setIsMandatory(false);
        setIsRecurring(false);
        setRecurrencePattern("DAILY");
        setRecurrenceDays("");
        setProjectId("");
        setAssignedToId("");
        setIsEditing(false);
        setIsMagicMode(false);
        setComments([]);
        setNewComment("");
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
                    bg-card w-full rounded-2xl shadow-2xl border border-border flex flex-col animate-in fade-in zoom-in duration-200 relative overflow-y-auto max-h-[90vh]
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
                            {description ? (() => {
                                // Pre-process: extract all images from markdown
                                const imageRegex = /!\[.*?\]\((.*?)\)/g;
                                const imageUrls: string[] = [];
                                let m;
                                while ((m = imageRegex.exec(description)) !== null) imageUrls.push(m[1]);
                                // Clean text: strip image syntax for text display
                                const cleanText = description.replace(/!\[.*?\]\(.*?\)/g, '').trim();

                                return (
                                    <>
                                        {/* Text portion */}
                                        {cleanText && (
                                            <div className="text-sm leading-relaxed text-foreground/90 font-medium 
                                                prose dark:prose-invert max-w-none 
                                                prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                                                prose-p:mb-3 last:prose-p:mb-0
                                                mb-4
                                            ">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {cleanText}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        {/* Image Gallery */}
                                        {imageUrls.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {imageUrls.map((src, i) => (
                                                    <span
                                                        key={i}
                                                        role="button"
                                                        onClick={() => setZoomedImage(src)}
                                                        title="Clique para ampliar"
                                                        style={{
                                                            display: 'inline-block',
                                                            width: '80px',
                                                            height: '80px',
                                                            cursor: 'pointer',
                                                            borderRadius: '8px',
                                                            overflow: 'hidden',
                                                            border: '2px solid rgba(255,255,255,0.1)',
                                                            flexShrink: 0,
                                                            transition: 'border-color 0.15s',
                                                        }}
                                                        onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.7)'; }}
                                                        onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
                                                    >
                                                        <img
                                                            src={src}
                                                            alt={`imagem ${i + 1}`}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                        />
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                );
                            })() : (
                                <p className="text-muted-foreground italic opacity-50">Sem descrição.</p>
                            )}
                        </div>

                        {/* Comments Section */}
                        {taskToEdit && (
                            <div className="mt-8 border-t border-border/50 pt-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <MessageSquare size={18} />
                                    Comentários
                                </h3>
                                
                                <div className="space-y-4 mb-6">
                                    {comments.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">Nenhum comentário ainda.</p>
                                    ) : (
                                        comments.map(comment => (
                                            <div key={comment.id} className="bg-muted/30 rounded-xl p-4 border border-border/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                                                        {comment.user?.name?.[0]?.toUpperCase() || "U"}
                                                    </div>
                                                    <span className="text-sm font-semibold">{comment.user?.name || "Usuário"}</span>
                                                    <span className="text-xs text-muted-foreground ml-auto">
                                                        {format(new Date(comment.createdAt), "dd MMM, HH:mm", { locale: ptBR })}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-foreground/90 whitespace-pre-wrap ml-8">
                                                    {comment.content}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Add Comment Input */}
                                <div className="flex gap-2">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Escreva um comentário..."
                                        rows={2}
                                        className="flex-1 bg-muted/50 border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                                    />
                                    <button
                                        onClick={submitComment}
                                        disabled={isSubmittingComment || !newComment.trim()}
                                        className="bg-primary text-white rounded-xl px-4 py-2 font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center"
                                        title="Enviar comentário"
                                    >
                                        {isSubmittingComment ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Edit Mode Form */}
                {isEditing && !isMagicMode && (
                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
                            {!isRecurring ? (
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
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 opacity-50">
                                        <Calendar size={14} /> Próxima Entrega
                                    </label>
                                    <div className="w-full bg-muted/30 border border-input border-dashed rounded-xl px-3 py-2 text-sm text-muted-foreground flex items-center h-[38px] cursor-not-allowed">
                                        Automático
                                    </div>
                                </div>
                            )}
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

                        {/* Options Checkboxes */}
                        <div className="flex flex-wrap items-center gap-6 bg-muted/20 px-4 py-3 rounded-xl border border-border/50">
                            {/* Mandatory Checkbox */}
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative flex items-center justify-center w-5 h-5 rounded overflow-hidden border border-input bg-card group-hover:border-primary transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={isRecurring ? true : isMandatory} 
                                            disabled={isRecurring}
                                            onChange={(e) => setIsMandatory(e.target.checked)}
                                            className="peer absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <div className="pointer-events-none w-full h-full bg-primary flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-semibold transition-colors ${(isRecurring ? true : isMandatory) ? 'text-primary' : 'text-foreground'}`}>
                                        Prazo Obrigatório
                                    </span>
                                </label>
                                <div className="group/tooltip relative flex items-center">
                                    <Info size={14} className="text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all border border-border z-10 text-center pointer-events-none">
                                        O responsável receberá um alerta via WhatsApp se não entregar a tarefa na data estipulada.
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-b border-r border-border rotate-45"></div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Recurring Checkbox */}
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative flex items-center justify-center w-5 h-5 rounded overflow-hidden border border-input bg-card group-hover:border-primary transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={isRecurring} 
                                            onChange={(e) => setIsRecurring(e.target.checked)}
                                            className="peer absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <div className="pointer-events-none w-full h-full bg-primary flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-semibold transition-colors ${isRecurring ? 'text-primary' : 'text-foreground'}`}>
                                        Tarefa Recorrente
                                    </span>
                                </label>
                                <div className="group/tooltip relative flex items-center">
                                    <Repeat size={14} className="text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all border border-border z-10 text-center pointer-events-none">
                                        Esta tarefa recriará automaticamente a próxima entrega quando for marcada como Concluída. Ativa "Prazo Obrigatório" automaticamente.
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-b border-r border-border rotate-45"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recurrence Pattern Configuration */}
                        {isRecurring && (
                            <div className="space-y-3 bg-primary/5 p-4 rounded-xl border border-primary/20 animate-in fade-in zoom-in-95 duration-200">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Repeat size={14} /> Frequência
                                    </label>
                                    <select
                                        value={recurrencePattern}
                                        onChange={(e) => setRecurrencePattern(e.target.value)}
                                        className="w-full bg-card border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground transition-all appearance-none"
                                    >
                                        <option value="DAILY">Todos os dias</option>
                                        <option value="WEEKLY">Semanalmente (no mesmo dia da semana)</option>
                                        <option value="MONTHLY">Mensalmente (no mesmo dia do mês)</option>
                                        <option value="CUSTOM_DAYS">Dias específicos da semana</option>
                                    </select>
                                </div>

                                {recurrencePattern === "CUSTOM_DAYS" && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Selecione os dias
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { val: "1", label: "Seg" },
                                                { val: "2", label: "Ter" },
                                                { val: "3", label: "Qua" },
                                                { val: "4", label: "Qui" },
                                                { val: "5", label: "Sex" },
                                                { val: "6", label: "Sáb" },
                                                { val: "0", label: "Dom" },
                                            ].map(day => {
                                                const selectedDays = recurrenceDays ? recurrenceDays.split(",") : [];
                                                const isSelected = selectedDays.includes(day.val);
                                                
                                                return (
                                                    <button
                                                        type="button"
                                                        key={day.val}
                                                        onClick={() => {
                                                            let newDays = [...selectedDays];
                                                            if (isSelected) {
                                                                newDays = newDays.filter(d => d !== day.val);
                                                            } else {
                                                                newDays.push(day.val);
                                                            }
                                                            setRecurrenceDays(newDays.join(","));
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                            isSelected 
                                                                ? "bg-primary text-white shadow-md shadow-primary/20" 
                                                                : "bg-muted text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
                                                        }`}
                                                    >
                                                        {day.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Project & Assignee Row - Hidden in Simple Mode */}
                        {!isSimpleMode && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Briefcase size={14} /> Projeto
                                    </label>
                                    <select
                                        value={projectId}
                                        onChange={(e) => setProjectId(e.target.value)}
                                        className="w-full bg-muted/50 border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground transition-all appearance-none"
                                    >
                                        <option value="" className="text-black dark:text-white bg-white dark:bg-slate-950">Nenhum projeto</option>
                                        {availableProjects.map(p => (
                                            <option key={p.id} value={p.id} className="text-black dark:text-white bg-white dark:bg-slate-950">{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Users size={14} /> Responsável
                                    </label>
                                    <select
                                        value={assignedToId}
                                        onChange={(e) => setAssignedToId(e.target.value)}
                                        className="w-full bg-muted/50 border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground transition-all appearance-none"
                                    >
                                        <option value="" className="text-black dark:text-white bg-white dark:bg-slate-950">Atribuir a mim</option>
                                        {teamMembers.map(member => (
                                            <option key={member.id} value={member.id} className="text-black dark:text-white bg-white dark:bg-slate-950">{member.name || member.email}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center pr-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <AlignLeft size={14} /> Descrição
                                </label>
                                <label title="Anexar arquivo em tamanho original" className="cursor-pointer text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors uppercase tracking-wider">
                                    <Paperclip size={14} /> Anexar Arquivo
                                    <input type="file" className="hidden" onChange={handleAttachmentChange} />
                                </label>
                            </div>
                            <div className="relative">
                                <textarea
                                    id="task-description-textarea"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Detalhes adicionais... (Cole prints com Ctrl + V)"
                                    rows={5}
                                    onPaste={handleDescriptionPaste}
                                    className="w-full bg-muted/50 border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50 resize-y transition-all min-h-[120px]"
                                />
                                {isUploadingImage && (
                                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center border border-primary/20 z-10">
                                        <Loader2 size={24} className="animate-spin text-primary mb-2" />
                                        <span className="text-xs font-bold text-primary animate-pulse">Enviando imagem...</span>
                                    </div>
                                )}
                            </div>
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

                {/* Fullscreen Image Zoom Overlay */}
                {zoomedImage && (
                    <div 
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in"
                        onClick={() => setZoomedImage(null)}
                    >
                        <button 
                            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
                            onClick={(e) => { e.stopPropagation(); setZoomedImage(null); }}
                        >
                            <X size={24} />
                        </button>
                        <img 
                            src={zoomedImage} 
                            alt="Zoomed Task Image" 
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()} // Prevent clicking image from closing
                        />
                    </div>
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
