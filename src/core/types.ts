export type WeekStart = "monday" | "sunday";

export type RepeatFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RepeatRule = {
  frequency: RepeatFrequency;
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
  activeTasksFolder: string;
  completedTasksFolder: string;
  newNoteName: string;
  newTaskName: string;
  noteTemplate: string;
  taskTemplate: string;
};
