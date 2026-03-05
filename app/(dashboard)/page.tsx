"use client";

import { useState, useEffect } from "react";
import TaskBoard from "@/components/TaskBoard";
import CreateTaskModal from "@/components/CreateTaskModal";
import MobileFAB from "@/components/MobileFAB";
import { UpcomingEventsWidget } from "@/components/UpcomingEventsWidget";
import { Task } from "@/types";
import { Plus, Sparkles } from "lucide-react";

// MOCK DATA for Initial Display


export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [startWithMagic, setStartWithMagic] = useState(false);

  // Fetch Tasks
  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSaveTask = async (taskData: any) => {
    const method = editingTask ? "PUT" : "POST";
    const body = editingTask ? { ...taskData, id: editingTask.id } : taskData;

    try {
      const res = await fetch("/api/tasks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        fetchTasks();
        setIsModalOpen(false);
        setEditingTask(null);
      }
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setStartWithMagic(false);
    setIsModalOpen(true);
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;

    // Optimistic delete
    setTasks(tasks.filter(t => t.id !== taskId));

    try {
      await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
    } catch (error) {
      console.error("Error deleting task:", error);
      fetchTasks();
    }
  };

  const handleTaskMove = async (taskId: number, newStatus: any) => {
    // 1. Optimistic Update
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    );
    setTasks(updatedTasks);

    // 2. Server Update
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
    } catch (error) {
      console.error("Failed to move task:", error);
      fetchTasks(); // Revert on error
    }
  };

  const handleQuickAction = async (task: Task) => {
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    handleTaskMove(task.id, newStatus);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Centro de Controle
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Gerencie suas tarefas de forma simples.
          </p>
        </div>

        <div className="hidden md:flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => { setEditingTask(null); setStartWithMagic(true); setIsModalOpen(true); }}
            className="flex-1 md:flex-none bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2.5 rounded-xl font-bold uppercase text-[10px] md:text-xs tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-purple-500/25 border border-white/10"
            title="Abra e pressione Ctrl+V para colar um print"
          >
            <Sparkles size={16} className="text-yellow-300" />
            <span>Tarefa Mágica</span>
          </button>

          <button
            onClick={() => { setEditingTask(null); setStartWithMagic(false); setIsModalOpen(true); }}
            className="flex-1 md:flex-none bg-primary hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/25 active:scale-95 text-sm md:text-base"
          >
            <Plus size={20} />
            <span className="whitespace-nowrap">Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <TaskBoard
        tasks={tasks}
        onTaskMove={handleTaskMove}
        onQuickAction={handleQuickAction}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
      />

      <UpcomingEventsWidget />

      {/* Floating Action Button (Mobile Only) */}
      {/* Floating Action Button (Mobile Only) */}
      <MobileFAB
        actions={[
          {
            label: "Tarefa Mágica",
            icon: <Sparkles size={16} className="text-yellow-300" />,
            onClick: () => { setEditingTask(null); setStartWithMagic(true); setIsModalOpen(true); },
            color: "bg-gradient-to-r from-blue-600 to-purple-600"
          },
          {
            label: "Nova Tarefa",
            icon: <Plus size={18} />,
            onClick: () => { setEditingTask(null); setStartWithMagic(false); setIsModalOpen(true); },
            color: "bg-primary"
          }
        ]}
      />

      {/* Modal */}
      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        taskToEdit={editingTask}
        startWithMagic={startWithMagic}
      />
    </div>
  );
}
