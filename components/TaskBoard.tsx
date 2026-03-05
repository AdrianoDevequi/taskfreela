"use client";

import { useState } from "react";
import { Task, TaskStatus } from "@/types";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import TaskCard from "./TaskCard";
import { GripVertical } from "lucide-react";

interface TaskBoardProps {
    tasks: Task[];
    onTaskMove: (taskId: number, newStatus: TaskStatus) => void;
    onQuickAction: (task: Task) => void;
    onEdit: (task: Task) => void;
    onDelete: (taskId: number) => void;
}

export default function TaskBoard({ tasks, onTaskMove, onQuickAction, onEdit, onDelete }: TaskBoardProps) {
    // Separate tasks by status (ensure tasks is an array)
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const todoTasks = safeTasks.filter(t => t.status === 'TODO');
    const inProgressTasks = safeTasks.filter(t => t.status === 'IN_PROGRESS');
    const doneTasks = safeTasks.filter(t => t.status === 'DONE');

    // Toggle state for secondary columns
    const [showSecondary, setShowSecondary] = useState(false);

    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        // Convert string ID back to number if needed (draggableId is always string)
        const taskId = Number(draggableId);
        const newStatus = destination.droppableId as TaskStatus;

        onTaskMove(taskId, newStatus);
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="h-[calc(100vh-140px)] flex flex-col gap-6 overflow-y-auto pb-4">

                {/* TOP SECTION: A Fazer (Full Width) */}
                <div className="flex-none">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]" />
                            <h2 className="font-bold text-lg tracking-tight">A Fazer</h2>
                            <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground">
                                {todoTasks.length}
                            </span>
                        </div>

                        {/* Toggle Button */}
                        <button
                            onClick={() => setShowSecondary(!showSecondary)}
                            className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-muted"
                        >
                            {showSecondary ? 'Ocultar Outros' : 'Mostrar Outros'}
                            <div className={`w-2 h-2 rounded-full ${showSecondary ? 'bg-primary' : 'bg-muted-foreground'}`} />
                        </button>
                    </div>

                    <Droppable droppableId="TODO" direction="horizontal">
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4 min-h-[140px] px-1"
                            >
                                {todoTasks.map((task, index) => (
                                    <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                className="w-full"
                                            >
                                                <TaskCard
                                                    task={task}
                                                    onQuickAction={onQuickAction}
                                                    onEdit={onEdit}
                                                    onDelete={onDelete}
                                                />
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                                {todoTasks.length === 0 && (
                                    <div className="col-span-full h-32 flex items-center justify-center border-2 border-dashed border-muted/50 rounded-xl">
                                        <p className="text-sm text-muted-foreground">Tudo limpo por aqui!</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Droppable>
                </div>

                {/* BOTTOM SECTION: Split View (In Progress / Done) */}
                {showSecondary && (
                    <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-[300px] animate-in slide-in-from-bottom-5 fade-in duration-300">
                        {/* In Progress */}
                        <Column title="Em Progresso" status="IN_PROGRESS" tasks={inProgressTasks} color="#3b82f6" onQuickAction={onQuickAction} onEdit={onEdit} onDelete={onDelete} />

                        {/* Done */}
                        <Column title="Concluído" status="DONE" tasks={doneTasks} color="#22c55e" onQuickAction={onQuickAction} onEdit={onEdit} onDelete={onDelete} />
                    </div>
                )}

            </div>
        </DragDropContext>
    );
}

// Helper Column Component for standard vertical lists
function Column({ title, status, tasks, color, onQuickAction, onEdit, onDelete }: { title: string, status: string, tasks: Task[], color: string, onQuickAction: any, onEdit: any, onDelete: any }) {
    return (
        <div className="flex-1 flex flex-col bg-secondary/30 rounded-2xl border border-border/50 backdrop-blur-sm h-full">
            <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}40` }} />
                    <h2 className="font-bold text-lg tracking-tight">{title}</h2>
                    <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground">
                        {tasks.length}
                    </span>
                </div>
            </div>

            <Droppable droppableId={status}>
                {(provided) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 p-3 space-y-3 overflow-y-auto"
                    >
                        {tasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                                {(provided) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                    >
                                        <TaskCard task={task} onQuickAction={onQuickAction} />
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
}
