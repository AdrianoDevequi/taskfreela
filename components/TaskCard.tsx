import { useState } from "react";
import { Task } from "@/types";
import { Calendar, AlertCircle, Pencil, Trash2, ChevronDown, ChevronUp, Clock, Briefcase, Repeat } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSimpleMode } from "@/app/context/SimpleModeContext";

interface TaskCardProps {
    task: Task;
    onQuickAction?: (task: Task) => void;
    onEdit?: (task: Task) => void;
    onDelete?: (taskId: number) => void;
}

export default function TaskCard({ task, onQuickAction, onEdit, onDelete }: TaskCardProps) {
    const { isSimpleMode } = useSimpleMode();
    const dueDate = new Date(task.dueDate);
    const isOverdue = isPast(dueDate) && !isToday(dueDate) && task.status !== 'DONE';

    return (
        <div
            onClick={() => onEdit?.(task)}
            className={`
        group relative p-4 rounded-xl bg-card border transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer h-full flex flex-col
        ${isOverdue
                    ? "border-destructive/50 hover:border-destructive shadow-[0_0_0_1px_rgba(239,68,68,0.2)]"
                    : "border-border hover:border-primary/50"
                }
      `}
        >
            {/* Overdue Glow/Indicator */}
            {isOverdue && (
                <div className="absolute top-3 right-3 animate-pulse text-destructive">
                    <AlertCircle size={18} />
                </div>
            )}

            {/* Task ID Indicator */}
            <div className="absolute top-3 left-3 text-[10px] font-mono text-muted-foreground/50">
                #{task.id}
            </div>

            <h3 className="font-semibold text-foreground pr-6 mt-4 mb-2 line-clamp-2">
                {task.title}
            </h3>

            {task.description && (() => {
                // Extract image URLs from markdown `![...](url)` syntax
                const imageRegex = /!\[.*?\]\((.*?)\)/g;
                const images: string[] = [];
                let match;
                while ((match = imageRegex.exec(task.description)) !== null) {
                    images.push(match[1]);
                }
                // Clean text: remove the markdown image syntax
                const cleanText = task.description.replace(/!\[.*?\]\(.*?\)/g, '').trim();

                return (
                    <div className="mb-4 flex-1">
                        {cleanText && (
                            <p className="text-sm text-gray-400 leading-relaxed max-w-full break-words line-clamp-2 mb-2">
                                {cleanText}
                            </p>
                        )}
                        {images.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {images.slice(0, 5).map((src, i) => (
                                    <img
                                        key={i}
                                        src={src}
                                        alt="preview"
                                        className="w-10 h-10 object-cover rounded-md border border-white/10"
                                    />
                                ))}
                                {images.length > 5 && (
                                    <div className="w-10 h-10 rounded-md bg-muted/50 border border-white/10 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                        +{images.length - 5}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })()}

            <div className="flex flex-col gap-2 mt-auto w-full">
                <div className="flex items-center gap-1.5 overflow-hidden w-full">
                    {/* Date Tag */}
                    <div
                        className={`
                            flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                            ${isOverdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"}
                        `}
                    >
                        <Calendar size={14} />
                        <span>
                            {format(dueDate, "d 'de' MMM", { locale: ptBR })}
                        </span>
                    </div>

                    {/* Project Badge */}
                    {task.project && (
                        <div className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 max-w-[80px] truncate shrink-0" title={task.project.name}>
                            <Briefcase size={10} className="shrink-0" />
                            <span className="truncate">{task.project.name}</span>
                        </div>
                    )}

                    {/* Time Tag */}
                    {task.estimatedTime && (
                        <div className={`
                            flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0
                            ${task.estimatedTime === 'Rápido' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}
                            ${task.estimatedTime === 'Mediano' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : ''}
                            ${task.estimatedTime === 'Demorado' ? 'bg-red-500/10 text-red-500 border-red-500/20' : ''}
                            ${!['Rápido', 'Mediano', 'Demorado'].includes(task.estimatedTime) ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                        `} title={task.estimatedTime}>
                            <Clock size={10} />
                            <span className="hidden sm:inline-block truncate max-w-[60px]">{task.estimatedTime}</span>
                        </div>
                    )}

                    {/* Recurrence Badge */}
                    {task.isRecurring && (
                        <div className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0" title="Tarefa Recorrente">
                            <Repeat size={10} className="shrink-0" />
                            <span className="hidden sm:inline-block truncate max-w-[80px]">
                                {task.recurrencePattern === 'DAILY' && 'Diário'}
                                {task.recurrencePattern === 'WEEKLY' && 'Semanal'}
                                {task.recurrencePattern === 'MONTHLY' && 'Mensal'}
                                {task.recurrencePattern === 'CUSTOM_DAYS' && task.recurrenceDays && (
                                    task.recurrenceDays.split(',').map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][parseInt(d)]).join(', ')
                                )}
                            </span>
                        </div>
                    )}

                    {/* Assignee Avatar */}
                    {task.assignedTo && !isSimpleMode && (
                        <div className="ml-auto flex items-center gap-1.5 bg-muted/30 pl-1.5 pr-2 py-1 rounded-full border border-border/50 shrink-0" title={`Responsável: ${task.assignedTo.name}`}>
                            {task.assignedTo.image ? (
                                <img src={task.assignedTo.image} alt={task.assignedTo.name} className="w-4 h-4 rounded-full object-cover" />
                            ) : (
                                <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[9px] border border-blue-500/30">
                                    {task.assignedTo.name?.[0]?.toUpperCase() || "U"}
                                </div>
                            )}
                            <span className="text-[10px] font-medium text-foreground max-w-[50px] truncate leading-none">{task.assignedTo.name.split(' ')[0]}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end w-full mt-2">
                    {/* Quick Actions - Always visible on mobile (touch), hover on desktop */}
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-auto">
                        {/* Edit */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit?.(task); }}
                            className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-md transition-colors"
                            title="Editar"
                        >
                            <Pencil size={14} />
                        </button>

                        {/* Delete */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete?.(task.id); }}
                            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                            title="Excluir"
                        >
                            <Trash2 size={14} />
                        </button>

                        <div className="w-px h-3 bg-border mx-1" />

                        {task.status !== 'DONE' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onQuickAction?.(task); }}
                                title="Concluir"
                                className="p-1.5 hover:bg-green-500/10 text-muted-foreground hover:text-green-500 rounded-md transition-colors"
                            >
                                <div className="w-4 h-4 rounded-full border border-current" />
                            </button>
                        )}
                        {task.status === 'DONE' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onQuickAction?.(task); }}
                                title="Reativar"
                                className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-md transition-colors"
                            >
                                <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center">
                                    <div className="w-2 h-2 bg-current rounded-full" />
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
