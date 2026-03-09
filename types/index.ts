export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Task {
    id: number;
    title: string;
    description?: string | null;
    dueDate: Date | string; // String for JSON serialization, Date for logic
    status: TaskStatus;
    estimatedTime?: string | null;
    createdAt?: Date | string;
    projectId?: string | null;
    project?: { id: string, name: string } | null;
    assignedTo?: { id: string, name: string, image: string | null } | null;
}
