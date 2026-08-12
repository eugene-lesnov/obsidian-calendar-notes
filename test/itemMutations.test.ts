import type { App, TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VaultAgendaSettings } from "../src/core/types";
import type { Task } from "../src/data/item";
import {
  completeRepeatingOccurrence,
  createDatedItem,
  createNote,
  createTask,
  reconcileItemName,
  setItemDate,
  setTaskRepeat,
  unscheduleTask,
} from "../src/data/itemMutations";
import { FakeApp } from "./obsidian";

const settings: VaultAgendaSettings = {
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
    completionBehavior: { type: "move", completedFolder: "Completed" },
  }],
  expandedTaskListIds: [],
  newNoteName: "Note",
  noteTemplate: "",
};

function addSourceTask(app: FakeApp): Task {
  const file = app.addFile("Completed/2026-08-10 - Task.md", {
    vaultAgendaItem: "task",
    date: "2026-08-10",
    done: true,
    completed: "2026-08-12",
    repeat: "daily",
  });

  return {
    kind: "task",
    file: file as unknown as TFile,
    title: "Task",
    dateId: "2026-08-10",
    done: true,
    completedDateId: "2026-08-12",
    repeat: { frequency: "daily" },
    taskListId: "list",
    taskLocation: "completed",
  };
}

function addExpectedOccurrence(app: FakeApp): void {
  app.addFile("Active/2026-08-13 - Task.md", {
    vaultAgendaItem: "task",
    date: "2026-08-13",
    done: false,
    repeat: "daily",
  });
}

describe("completeRepeatingOccurrence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates the next occurrence and clears repeat on the source task", async () => {
    const app = new FakeApp();
    const source = addSourceTask(app);

    await completeRepeatingOccurrence(app as unknown as App, settings, source);

    const occurrence = app.files.get("Active/2026-08-13 - Task.md");
    expect(occurrence).toBeDefined();
    expect(app.createdPaths).toEqual(["Active/2026-08-13 - Task.md"]);
    expect(app.frontmatter.get(source.file))
      .not.toHaveProperty("repeat");
  });

  it("accepts an already-created expected occurrence without creating a duplicate", async () => {
    const app = new FakeApp();
    const source = addSourceTask(app);
    addExpectedOccurrence(app);

    await completeRepeatingOccurrence(app as unknown as App, settings, source);

    expect(app.createdPaths).toEqual([]);
    expect(app.frontmatter.get(source.file))
      .not.toHaveProperty("repeat");
  });

  it("preserves repeat when the target path contains an incompatible file", async () => {
    const app = new FakeApp();
    const source = addSourceTask(app);
    app.addFile("Active/2026-08-13 - Task.md", {
      vaultAgendaItem: "task",
      date: "2026-08-14",
      done: false,
      repeat: "daily",
    });

    await expect(
      completeRepeatingOccurrence(app as unknown as App, settings, source),
    ).rejects.toThrow();

    expect(app.createdPaths).toEqual([]);
    expect(app.frontmatter.get(source.file))
      .toHaveProperty("repeat", "daily");
  });

  it("does not clear repeat when the source task no longer matches", async () => {
    const app = new FakeApp();
    const source = addSourceTask(app);
    addExpectedOccurrence(app);
    const sourceFrontmatter = app.frontmatter.get(source.file);
    sourceFrontmatter!.done = false;

    await expect(
      completeRepeatingOccurrence(app as unknown as App, settings, source),
    ).rejects.toThrow("Task changed before its repeat could be advanced");

    expect(sourceFrontmatter).toHaveProperty("repeat", "daily");
  });

  it("does nothing for non-repeating, unscheduled or stale occurrences", async () => {
    const app = new FakeApp();
    const source = addSourceTask(app);

    await completeRepeatingOccurrence(
      app as unknown as App,
      settings,
      { ...source, repeat: undefined },
    );
    await completeRepeatingOccurrence(
      app as unknown as App,
      settings,
      { ...source, dateId: undefined },
    );
    app.frontmatter.get(source.file)!.date = "2026-08-09";
    await completeRepeatingOccurrence(app as unknown as App, settings, source);

    expect(app.createdPaths).toEqual([]);
    expect(app.frontmatter.get(source.file)).toHaveProperty("repeat", "daily");
  });

  it("rejects a repeating task whose list no longer exists", async () => {
    const app = new FakeApp();
    const source = addSourceTask(app);

    await expect(completeRepeatingOccurrence(
      app as unknown as App,
      { ...settings, taskLists: [] },
      source,
    )).rejects.toThrow();
  });
});

describe("item mutations", () => {
  it("creates dated notes from templates without reserved field overrides", async () => {
    const app = new FakeApp();
    app.addFile(
      "Templates/Note.md",
      { tag: "template", date: "wrong", vaultAgendaItem: "task" },
      "---\n{}\n---\nTemplate body\n",
    );
    const configured = {
      ...settings,
      noteTemplate: "Templates/Note",
    };

    const file = await createNote(app as unknown as App, configured, "2026-08-12");
    const frontmatter = app.frontmatter.get(file);
    expect(file.path).toBe("Notes/2026-08-12 - Note.md");
    expect(frontmatter).toMatchObject({
      tag: "template",
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });
    expect(frontmatter).not.toHaveProperty("done");
  });

  it("creates uniquely named unscheduled tasks", async () => {
    const app = new FakeApp();
    app.addFile("Active/Task.md", {});

    const file = await createTask(
      app as unknown as App,
      settings,
      settings.taskLists[0],
    );

    expect(file.path).toBe("Active/Task (2).md");
    expect(app.frontmatter.get(file)).toMatchObject({
      vaultAgendaItem: "task",
      done: false,
    });
    expect(app.frontmatter.get(file)).not.toHaveProperty("date");
  });

  it("routes dated item creation and requires a configured task list", async () => {
    const app = new FakeApp();
    const note = await createDatedItem(
      app as unknown as App,
      settings,
      "note",
      "2026-08-12",
    );
    expect(note.path).toBe("Notes/2026-08-12 - Note.md");

    await expect(createDatedItem(
      app as unknown as App,
      { ...settings, taskLists: [] },
      "task",
      "2026-08-12",
    )).rejects.toThrow();
  });

  it("falls back to an empty body when a configured template is missing", async () => {
    const app = new FakeApp();
    const taskList = { ...settings.taskLists[0], taskTemplate: "Missing" };

    const file = await createTask(app as unknown as App, settings, taskList, "2026-08-12");

    expect(file.path).toBe("Active/Task.md");
    expect(app.frontmatter.get(file)).toMatchObject({ date: "2026-08-12", done: false });
  });

  it("updates and removes task scheduling with optimistic checks", async () => {
    const app = new FakeApp();
    const task = addSourceTask(app);

    await setItemDate(app as unknown as App, settings, task, "2026-08-15");
    expect(app.frontmatter.get(task.file)).toHaveProperty("date", "2026-08-15");
    await expect(
      setItemDate(app as unknown as App, settings, task, "2026-08-16"),
    ).rejects.toThrow("Item changed before its date could be updated");

    const latest = { ...task, dateId: "2026-08-15" };
    await unscheduleTask(app as unknown as App, settings, latest);
    expect(app.frontmatter.get(task.file)).not.toHaveProperty("date");
    expect(app.frontmatter.get(task.file)).not.toHaveProperty("repeat");
  });

  it("sets and clears repeat only for an unchanged scheduled task", async () => {
    const app = new FakeApp();
    const task = addSourceTask(app);

    await setTaskRepeat(app as unknown as App, settings, task, { frequency: "weekly" });
    expect(app.frontmatter.get(task.file)).toHaveProperty("repeat", "weekly");
    await setTaskRepeat(app as unknown as App, settings, task, null);
    expect(app.frontmatter.get(task.file)).not.toHaveProperty("repeat");

    const unscheduled = { ...task, dateId: undefined };
    await expect(
      setTaskRepeat(app as unknown as App, settings, unscheduled, { frequency: "daily" }),
    ).rejects.toThrow();
  });

  it("reconciles note date from a renamed filename", async () => {
    const app = new FakeApp();
    const file = app.addFile("Notes/2026-08-13 - Note.md", {
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });

    await reconcileItemName(app as unknown as App, settings, file as unknown as TFile, "name");

    expect(app.frontmatter.get(file)).toHaveProperty("date", "2026-08-13");
  });

  it("reconciles note filename from changed frontmatter", async () => {
    const app = new FakeApp();
    const file = app.addFile("Notes/2026-08-13 - Note.md", {
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });

    await reconcileItemName(
      app as unknown as App,
      settings,
      file as unknown as TFile,
      "frontmatter",
    );

    expect(file.path).toBe("Notes/2026-08-12 - Note.md");
  });

  it("uses a unique name during frontmatter reconciliation conflicts", async () => {
    const app = new FakeApp();
    const file = app.addFile("Notes/2026-08-13 - Note.md", {
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });
    app.addFile("Notes/2026-08-12 - Note.md", {});

    await reconcileItemName(
      app as unknown as App,
      settings,
      file as unknown as TFile,
      "frontmatter",
    );

    expect(file.path).toBe("Notes/2026-08-12 - Note (2).md");
  });
});
