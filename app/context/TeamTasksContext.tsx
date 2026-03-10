"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { updateTeamTasksPreference } from "@/app/lib/actions";

interface TeamTasksContextProps {
  showTeamTasks: boolean;
  toggleTeamTasks: () => void;
}

const TeamTasksContext = createContext<TeamTasksContextProps | undefined>(undefined);

export function TeamTasksProvider({
  children,
  initialShowTeamTasks,
}: {
  children: ReactNode;
  initialShowTeamTasks: boolean;
}) {
  const [showTeamTasks, setShowTeamTasks] = useState(initialShowTeamTasks);
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync with prop if it changes (e.g., when the user reloads or navigates)
  useEffect(() => {
    setShowTeamTasks(initialShowTeamTasks);
  }, [initialShowTeamTasks]);

  const toggleTeamTasks = useCallback(async () => {
    if (isUpdating) return;

    const newValue = !showTeamTasks;
    
    // Optimistic UI update
    setShowTeamTasks(newValue);
    setIsUpdating(true);

    try {
      const result = await updateTeamTasksPreference(newValue);
      
      if (result?.error) {
        // Revert on error
        setShowTeamTasks(!newValue);
        console.error("Failed to update team tasks preference:", result.error);
      }
    } catch (error) {
       // Revert on expected error
       setShowTeamTasks(!newValue);
       console.error("Exception updating team tasks preference:", error);
    } finally {
      setIsUpdating(false);
    }
  }, [showTeamTasks, isUpdating]);

  return (
    <TeamTasksContext.Provider value={{ showTeamTasks, toggleTeamTasks }}>
      {children}
    </TeamTasksContext.Provider>
  );
}

export function useTeamTasks() {
  const context = useContext(TeamTasksContext);
  if (context === undefined) {
    throw new Error("useTeamTasks must be used within a TeamTasksProvider");
  }
  return context;
}
