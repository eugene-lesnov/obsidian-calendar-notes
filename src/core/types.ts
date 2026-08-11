export type WeekStart = "monday" | "sunday";

export type RepeatFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RepeatRule = {
  frequency: RepeatFrequency;
};

export type TaskLocation = "active" | "completed";

export type TaskListColor = string | null;

export type TaskOrder = "title-asc" | "title-desc" | "date-asc" | "date-desc" | "manual";

export type CompletionBehavior =
  | { type: "keep" }
  | { type: "move"; completedFolder: string };

export type TaskList = {
  id: string;
  name: string;
  color: TaskListColor;
  activeFolder: string;
  newTaskName: string;
  taskTemplate: string;
  order: TaskOrder;
  manualOrder: string[];
  completionBehavior: CompletionBehavior;
};

export type DateParts = {
  year: number;
  month: number;
  day: number;
};

export type VaultAgendaSettings = {
  dateFormat: string;
  weekStart: WeekStart;
  notesFolder: string;
  taskLists: TaskList[];
  expandedTaskListIds: string[];
  newNoteName: string;
  noteTemplate: string;
};
