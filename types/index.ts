export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'PENDING_APPROVAL';

export interface Task {
    id: number;
    title: string;
    description?: string | null;
    dueDate: Date | string; // String for JSON serialization, Date for logic
    status: TaskStatus;
    estimatedTime?: string | null;
    isMandatory?: boolean;
    isRecurring?: boolean;
    recurrencePattern?: string | null;
    recurrenceDays?: string | null;
    createdAt?: Date | string;
    projectId?: string | null;
    project?: { id: string, name: string, url?: string | null } | null;
    assignedTo?: { id: string, name: string, image: string | null } | null;
    createdBy?: { id: string, name: string } | null;
}
