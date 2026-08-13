import type { TFile } from "obsidian";

import type { TaskList, VaultAgendaSettings } from "../src/core/types";
import type { Task } from "../src/data/item";
import type { FakeApp } from "./obsidian";

export function createTaskList(overrides: Partial<TaskList> = {}): TaskList {
  return {
    id: "list",
    name: "Tasks",
    color: null,
    activeFolder: "Active",
    newTaskName: "Task",
    taskTemplate: "",
    order: "title-asc",
    manualOrder: [],
    completionBehavior: { type: "move", completedFolder: "Completed" },
    ...overrides,
  };
}

export function createSettings(
  overrides: Partial<VaultAgendaSettings> = {},
): VaultAgendaSettings {
  return {
    dateFormat: "YYYY-MM-DD",
    weekStart: "monday",
    notesFolder: "Notes",
    taskLists: [createTaskList()],
    taskListsExpanded: false,
    expandedTaskListIds: [],
    newNoteName: "Note",
    noteTemplate: "",
    ...overrides,
  };
}

export function addTask(
  app: FakeApp,
  path: string,
  options: {
    dateId?: string;
    done?: boolean;
    completedDateId?: string;
    repeat?: "daily" | "weekly" | "monthly" | "yearly";
    taskListId?: string;
    taskLocation?: "active" | "completed";
  } = {},
): Task {
  const done = options.done ?? false;
  const frontmatter: Record<string, unknown> = {
    vaultAgendaItem: "task",
    done,
  };

  if (options.dateId) {
    frontmatter.date = options.dateId;
  }

  if (options.completedDateId) {
    frontmatter.completed = options.completedDateId;
  }

  if (options.repeat) {
    frontmatter.repeat = options.repeat;
  }

  const file = app.addFile(path, frontmatter);

  return {
    kind: "task",
    file: file as unknown as TFile,
    title: file.basename.replace(/^\d{4}-\d{2}-\d{2} - /, ""),
    done,
    ...(options.dateId ? { dateId: options.dateId } : {}),
    ...(options.completedDateId ? { completedDateId: options.completedDateId } : {}),
    ...(options.repeat ? { repeat: { frequency: options.repeat } } : {}),
    taskListId: options.taskListId ?? "list",
    taskLocation: options.taskLocation
      ?? (path.startsWith("Completed/") ? "completed" : "active"),
  };
}
