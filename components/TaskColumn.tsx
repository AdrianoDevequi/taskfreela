import { Task, TaskStatus } from "@/types";
import TaskCard from "./TaskCard";

interface TaskColumnProps {
    title: string;
    status: TaskStatus;
    tasks: Task[];
    color?: string; // Hex color for the header indicator
}

export default function TaskColumn({ title, status, tasks, color = "#3b82f6" }: TaskColumnProps) {
    return (
        <div className="flex-1 min-w-[300px] flex flex-col h-full bg-secondary/30 rounded-2xl border border-border/50 backdrop-blur-sm">
            {/* Column Header */}
            <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div
                        className="w-3 h-3 rounded-full shadow-[0_0_10px]"
                        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}40` }}
                    />
                    <h2 className="font-bold text-lg tracking-tight">{title}</h2>
                    <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground">
                        {tasks.length}
                    </span>
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                ))}

                {tasks.length === 0 && (
                    <div className="h-32 flex items-center justify-center border-2 border-dashed border-muted/50 rounded-xl m-2">
                        <p className="text-sm text-muted-foreground">Sem tarefas</p>
                    </div>
                )}
            </div>
        </div>
    );
}
