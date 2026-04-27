"use client";

import { useState, useEffect } from "react";
import TaskBoard from "@/components/TaskBoard";
import CreateTaskModal from "@/components/CreateTaskModal";
import MobileFAB from "@/components/MobileFAB";
import { UpcomingEventsWidget } from "@/components/UpcomingEventsWidget";
import { Task } from "@/types";
import { Plus, Sparkles, Zap, ZapOff, Users, Repeat } from "lucide-react";
import { useSimpleMode } from "@/app/context/SimpleModeContext";
import { useTeamTasks } from "@/app/context/TeamTasksContext";
import { useSession } from "next-auth/react";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
}

export default function Home() {
  const { data: session } = useSession();
  const { isSimpleMode, toggleSimpleMode } = useSimpleMode();
  const { showTeamTasks, toggleTeamTasks } = useTeamTasks();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [startWithMagic, setStartWithMagic] = useState(false);
  const [startInEditMode, setStartInEditMode] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Fallback for NextAuth Client Session Bug
  const [activeUser, setActiveUser] = useState<{ id?: string; email?: string } | null>(null);

  useEffect(() => {
    // Explicitly fetch user ID and Email from the server side API
    // This bypasses the buggy useSession() client cache behavior
    fetch("/api/user")
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setActiveUser(data);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (showTeamTasks && !isSimpleMode) {
      fetch("/api/team")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setTeamMembers(data);
        })
        .catch(console.error);
    } else {
      setTeamMembers([]);
      setSelectedMemberId(null);
    }
  }, [showTeamTasks, isSimpleMode]);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        console.error("API returned non-array:", data);
        setTasks([]);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

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

  const handleEditTask = (task: Task, editMode = false) => {
    setEditingTask(task);
    setStartWithMagic(false);
    setStartInEditMode(editMode);
    setIsModalOpen(true);
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;
    setTasks(tasks.filter(t => t.id !== taskId));
    try {
      await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
    } catch (error) {
      console.error("Error deleting task:", error);
      fetchTasks();
    }
  };

  const handleTaskMove = async (taskId: number, newStatus: any) => {
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
    setTasks(updatedTasks);
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
    } catch (error) {
      console.error("Failed to move task:", error);
      fetchTasks();
    }
  };

  const handleQuickAction = async (task: Task) => {
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    handleTaskMove(task.id, newStatus);
  };

  const handleStatusChange = (taskId: number, newStatus: string) => {
    handleTaskMove(taskId, newStatus as any);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Centro de Controle
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-muted-foreground text-sm md:text-base">
              Gerencie suas tarefas de forma simples.
            </p>
            <button
              onClick={toggleSimpleMode}
              className={`
                flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all
                ${isSimpleMode 
                  ? 'bg-green-500/10 text-green-500 border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
                }
              `}
              title={isSimpleMode ? "Desativar Modo Simples" : "Ativar Modo Simples"}
            >
              {isSimpleMode ? <Zap size={14} className="fill-green-500" /> : <ZapOff size={14} />}
              <span>Modo Simples</span>
            </button>
            
            {!isSimpleMode && (
              <button
                onClick={toggleTeamTasks}
                className={`
                  flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all
                  ${showTeamTasks
                    ? 'bg-blue-500/10 text-blue-500 border border-blue-500/30'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
                  }
                `}
                title={showTeamTasks ? "Ocultar Equipe" : "Mostrar Equipe"}
              >
                <Users size={14} className={showTeamTasks ? "text-blue-500" : ""} />
                <span>Equipe</span>
              </button>
            )}

            {/* Team member filter chips — inline, after Equipe button */}
            {!isSimpleMode && showTeamTasks && teamMembers.length > 0 && (
              <>
                <div className="w-px h-4 bg-border/50" />
                <button
                  onClick={() => setSelectedMemberId(null)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                    selectedMemberId === null
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'
                  }`}
                >
                  Todos
                </button>
                {teamMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMemberId(prev => prev === member.id ? null : member.id)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                      selectedMemberId === member.id
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                        : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {member.image ? (
                      <img src={member.image} alt={member.name ?? ''} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-blue-500/30 flex items-center justify-center text-[9px] font-bold text-blue-300">
                        {(member.name ?? member.email ?? '?')[0].toUpperCase()}
                      </div>
                    )}
                    {member.name ?? member.email}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => { setEditingTask(null); setStartWithMagic(true); setIsModalOpen(true); }}
            className="flex-1 md:flex-none bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 hover:from-blue-700 hover:via-indigo-600 hover:to-purple-600 text-white px-4 py-2.5 rounded-full font-bold uppercase text-[10px] md:text-xs tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-purple-500/25 border border-white/10"
          >
            <Sparkles size={16} className="text-yellow-300" />
            <span>Tarefa Mágica</span>
          </button>
          <button
            onClick={() => { setEditingTask(null); setStartWithMagic(false); setIsModalOpen(true); }}
            className="flex-1 md:flex-none bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full font-medium flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 text-sm md:text-base"
          >
            <Plus size={20} />
            <span className="whitespace-nowrap">Nova Tarefa</span>
          </button>
        </div>
      </div>

      <TaskBoard
        tasks={(() => {
          let filtered = tasks;

          // Personal filter: simple mode or team mode off
          if (isSimpleMode || !showTeamTasks) {
            const userId = activeUser?.id || (session?.user as any)?.id;
            const userEmail = activeUser?.email || session?.user?.email;
            filtered = tasks.filter(t => {
              const assignedToId = t.assignedTo?.id;
              const assignedToEmail = (t.assignedTo as any)?.email;
              const createdById = (t as any).createdBy?.id;
              const isMine = (!assignedToId) ||
                             (assignedToId && userId && assignedToId === userId) ||
                             (assignedToEmail && userEmail && assignedToEmail === userEmail);
              const isPendingMyApproval = t.status === 'PENDING_APPROVAL' && userId && createdById === userId;
              const isApprovedByMe = t.status === 'APPROVED' && userId && createdById === userId;
              return isMine || isPendingMyApproval || isApprovedByMe;
            });
          }

          // Member filter: applied on top when in team mode
          if (!isSimpleMode && showTeamTasks && selectedMemberId) {
            filtered = filtered.filter(t => t.assignedTo?.id === selectedMemberId);
          }

          return filtered;
        })()}
        onTaskMove={handleTaskMove}
        onQuickAction={handleQuickAction}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
      />

      <UpcomingEventsWidget />

      <MobileFAB
        actions={[
          {
            label: "Tarefa Mágica",
            icon: <Sparkles size={16} className="text-yellow-300" />,
            onClick: () => { setEditingTask(null); setStartWithMagic(true); setIsModalOpen(true); },
            color: "bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500"
          },
          {
            label: "Nova Tarefa",
            icon: <Plus size={18} />,
            onClick: () => { setEditingTask(null); setStartWithMagic(false); setIsModalOpen(true); },
            color: "bg-blue-500"
          }
        ]}
      />

      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        onQuickAction={handleQuickAction}
        onStatusChange={handleStatusChange}
        taskToEdit={editingTask}
        startWithMagic={startWithMagic}
        startInEditMode={startInEditMode}
        currentUserId={activeUser?.id}
      />
    </div>
  );
}
