export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface Task {
    id: number;
    title: string;
    description?: string | null;
    dueDate: Date | string; // String for JSON serialization, Date for logic
    status: TaskStatus;
    estimatedTime?: string | null;
    createdAt?: Date | string;
}
