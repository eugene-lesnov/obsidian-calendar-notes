export type WeekStart = "monday" | "sunday";

export type RepeatFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RepeatRule = {
  frequency: RepeatFrequency;
};

export type TaskLocation = "active" | "completed";

export type CompletionBehavior =
  | { type: "keep" }
  | { type: "move"; completedFolder: string };

export type TaskList = {
  id: string;
  name: string;
  activeFolder: string;
  newTaskName: string;
  taskTemplate: string;
  completionBehavior: CompletionBehavior;
};

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

export type CalendarSettings = {
  dateFormat: string;
  weekStart: WeekStart;
  notesFolder: string;
  taskLists: TaskList[];
  expandedTaskListIds: string[];
  newNoteName: string;
  noteTemplate: string;
};
