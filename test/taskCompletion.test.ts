import type { App, TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskList, VaultAgendaSettings } from "../src/core/types";
import type { Task } from "../src/data/item";
import {
  applyExternalTaskCompletion,
  needsTaskCompletionReconciliation,
  setTaskCompleted,
} from "../src/data/taskCompletion";
import { FakeApp } from "./obsidian";

function createSettings(completionBehavior: TaskList["completionBehavior"]): VaultAgendaSettings {
  return {
    dateFormat: "YYYY-MM-DD",
    weekStart: "monday",
    notesFolder: "Notes",
    taskLists: [{
      id: "list",
      name: "Tasks",
      color: null,
      activeFolder: "Active",
      newTaskName: "Task",
      taskTemplate: "",
      order: "title-asc",
      manualOrder: [],
      completionBehavior,
    }],
    expandedTaskListIds: [],
    newNoteName: "Note",
    noteTemplate: "",
  };
}

function addTask(
  app: FakeApp,
  path: string,
  done: boolean,
  completed?: string,
): Task {
  const frontmatter: Record<string, unknown> = {
    vaultAgendaItem: "task",
    done,
  };

  if (completed) {
    frontmatter.completed = completed;
  }

  const file = app.addFile(path, frontmatter);

  return {
    kind: "task",
    file: file as unknown as TFile,
    title: file.basename,
    done,
    ...(completed ? { completedDateId: completed } : {}),
    taskListId: "list",
    taskLocation: path.startsWith("Completed/") ? "completed" : "active",
  };
}

describe("task completion reconciliation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects frontmatter and location mismatches", () => {
    const settings = createSettings({ type: "move", completedFolder: "Completed" });
    const app = new FakeApp();

    expect(needsTaskCompletionReconciliation(
      settings,
      addTask(app, "Active/open.md", false),
    )).toBe(false);
    expect(needsTaskCompletionReconciliation(
      settings,
      addTask(app, "Active/done.md", true),
    )).toBe(true);
    expect(needsTaskCompletionReconciliation(
      settings,
      addTask(app, "Completed/reopened.md", false, "2026-08-12"),
    )).toBe(true);
    expect(needsTaskCompletionReconciliation(
      { ...settings, taskLists: [] },
      addTask(app, "Active/unknown.md", true),
    )).toBe(false);
  });

  it("adds completed and moves an externally completed task", async () => {
    const settings = createSettings({ type: "move", completedFolder: "Completed" });
    const app = new FakeApp();
    const task = addTask(app, "Active/Task.md", true);

    await applyExternalTaskCompletion(app as unknown as App, settings, task);

    expect(task.file.path).toBe("Completed/Task.md");
    expect(app.frontmatter.get(task.file))
      .toHaveProperty("completed", "2026-08-12");
    expect(app.processFrontMatterCount).toBe(1);
    expect(app.renameCount).toBe(1);
  });

  it("removes completed and returns an externally reopened task", async () => {
    const settings = createSettings({ type: "move", completedFolder: "Completed" });
    const app = new FakeApp();
    const task = addTask(app, "Completed/Task.md", false, "2026-08-11");

    await applyExternalTaskCompletion(app as unknown as App, settings, task);

    expect(task.file.path).toBe("Active/Task.md");
    expect(app.frontmatter.get(task.file))
      .not.toHaveProperty("completed");
  });

  it("updates frontmatter without moving tasks configured to stay in place", async () => {
    const settings = createSettings({ type: "keep" });
    const app = new FakeApp();
    const task = addTask(app, "Active/Task.md", true);

    await applyExternalTaskCompletion(app as unknown as App, settings, task);

    expect(task.file.path).toBe("Active/Task.md");
    expect(app.frontmatter.get(task.file))
      .toHaveProperty("completed", "2026-08-12");
    expect(app.renameCount).toBe(0);
  });

  it("preserves completed after a failed move and succeeds on retry", async () => {
    const settings = createSettings({ type: "move", completedFolder: "Completed" });
    const app = new FakeApp();
    const task = addTask(app, "Active/Task.md", true);
    app.failNextRename = true;

    await expect(
      applyExternalTaskCompletion(app as unknown as App, settings, task),
    ).rejects.toThrow("Rename failed");

    expect(task.file.path).toBe("Active/Task.md");
    expect(app.frontmatter.get(task.file))
      .toHaveProperty("completed", "2026-08-12");

    const retryTask: Task = {
      ...task,
      completedDateId: "2026-08-12",
    };
    await applyExternalTaskCompletion(app as unknown as App, settings, retryTask);

    expect(task.file.path).toBe("Completed/Task.md");
    expect(app.processFrontMatterCount).toBe(1);
    expect(app.renameCount).toBe(2);
  });

  it("does not write or move a task whose state is already consistent", async () => {
    const settings = createSettings({ type: "move", completedFolder: "Completed" });
    const app = new FakeApp();
    const task = addTask(app, "Completed/Task.md", true, "2026-08-12");

    await applyExternalTaskCompletion(app as unknown as App, settings, task);

    expect(app.processFrontMatterCount).toBe(0);
    expect(app.renameCount).toBe(0);
  });

  it("rejects a stale done value during external synchronization", async () => {
    const settings = createSettings({ type: "keep" });
    const app = new FakeApp();
    const task = addTask(app, "Active/Task.md", true);
    app.frontmatter.get(task.file)!.done = false;

    await expect(
      applyExternalTaskCompletion(app as unknown as App, settings, task),
    ).rejects.toThrow("Task changed during completion synchronization");
  });
});

describe("setTaskCompleted", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves and completes a task, then can reopen it", async () => {
    const settings = createSettings({ type: "move", completedFolder: "Completed" });
    const app = new FakeApp();
    const task = addTask(app, "Active/Area/Task.md", false);

    await setTaskCompleted(app as unknown as App, settings, task, true);
    expect(task.file.path).toBe("Completed/Area/Task.md");
    expect(app.frontmatter.get(task.file)).toMatchObject({
      done: true,
      completed: "2026-08-12",
    });

    const completed: Task = {
      ...task,
      done: true,
      completedDateId: "2026-08-12",
      taskLocation: "completed",
    };
    await setTaskCompleted(app as unknown as App, settings, completed, false);
    expect(task.file.path).toBe("Active/Area/Task.md");
    expect(app.frontmatter.get(task.file)).toMatchObject({ done: false });
    expect(app.frontmatter.get(task.file)).not.toHaveProperty("completed");
  });

  it("uses a unique target path when the destination already exists", async () => {
    const settings = createSettings({ type: "move", completedFolder: "Completed" });
    const app = new FakeApp();
    const task = addTask(app, "Active/Task.md", false);
    app.addFile("Completed/Task.md", {});

    await setTaskCompleted(app as unknown as App, settings, task, true);

    expect(task.file.path).toBe("Completed/Task (2).md");
  });

  it("rolls the move back when frontmatter update fails", async () => {
    const settings = createSettings({ type: "move", completedFolder: "Completed" });
    const app = new FakeApp();
    const task = addTask(app, "Active/Task.md", false);
    app.failNextProcessFrontMatter = true;

    await expect(
      setTaskCompleted(app as unknown as App, settings, task, true),
    ).rejects.toThrow("Frontmatter update failed");

    expect(task.file.path).toBe("Active/Task.md");
    expect(app.frontmatter.get(task.file)).toMatchObject({ done: false });
    expect(app.renameCount).toBe(2);
  });

  it("rejects stale task snapshots without moving the file", async () => {
    const settings = createSettings({ type: "move", completedFolder: "Completed" });
    const app = new FakeApp();
    const task = addTask(app, "Active/Task.md", false);
    app.frontmatter.get(task.file)!.done = true;

    await expect(
      setTaskCompleted(app as unknown as App, settings, task, true),
    ).rejects.toThrow("Task changed before its completion could be updated");
    expect(task.file.path).toBe("Active/Task.md");
  });

  it("can stop a repeat while completing without moving", async () => {
    const settings = createSettings({ type: "keep" });
    const app = new FakeApp();
    const task = addTask(app, "Active/Task.md", false);
    app.frontmatter.get(task.file)!.repeat = "daily";

    await setTaskCompleted(
      app as unknown as App,
      settings,
      task,
      true,
      { stopRepeat: true },
    );

    expect(app.frontmatter.get(task.file)).not.toHaveProperty("repeat");
    expect(task.file.path).toBe("Active/Task.md");
  });

  it("does nothing when the requested completion state already matches", async () => {
    const settings = createSettings({ type: "keep" });
    const app = new FakeApp();
    const task = addTask(app, "Active/Task.md", false);

    await setTaskCompleted(app as unknown as App, settings, task, false);

    expect(app.processFrontMatterCount).toBe(0);
    expect(app.renameCount).toBe(0);
  });

  it("rejects tasks outside their configured scope", async () => {
    const settings = createSettings({ type: "move", completedFolder: "Completed" });
    const app = new FakeApp();
    const task = addTask(app, "Outside/Task.md", false);

    await expect(
      setTaskCompleted(app as unknown as App, settings, task, true),
    ).rejects.toThrow();
  });
});
