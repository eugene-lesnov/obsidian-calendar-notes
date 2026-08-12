import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";

import {
  classifyItemFileDetailed,
  normalizeDateId,
} from "../src/data/item";
import {
  configuredScopeFolders,
  findTaskScope,
  isFileInsideFolder,
  validateTaskLists,
} from "../src/data/itemScopes";
import { createSettings, createTaskList } from "./fixtures";
import { FakeApp } from "./obsidian";

function asFile(file: import("./obsidian").TFile): TFile {
  return file as unknown as TFile;
}

describe("task scopes", () => {
  it("matches active and completed scopes while preserving relative paths", () => {
    const app = new FakeApp();
    const settings = createSettings();
    const active = asFile(app.addFile("Active/Area/Task.md", {}));
    const completed = asFile(app.addFile("Completed/Area/Task.md", {}));

    expect(findTaskScope(active, settings)).toMatchObject({
      location: "active",
      relativePath: "Area/Task.md",
    });
    expect(findTaskScope(completed, settings)).toMatchObject({
      location: "completed",
      relativePath: "Area/Task.md",
    });
    expect(isFileInsideFolder(active, "Active")).toBe(true);
    expect(isFileInsideFolder(active, "Act")).toBe(false);
  });

  it("reduces nested configured scopes and lets root cover the vault", () => {
    const nested = createSettings({
      notesFolder: "Area",
      taskLists: [createTaskList({
        activeFolder: "Area/Active",
        completionBehavior: { type: "move", completedFolder: "Archive" },
      })],
    });
    expect(configuredScopeFolders(nested)).toEqual(["Area", "Archive"]);

    expect(configuredScopeFolders(createSettings({ notesFolder: "/" }))).toEqual(["/"]);
  });

  it("rejects invalid IDs, names, folders and overlapping scopes", () => {
    const valid = createSettings();
    expect(() => validateTaskLists(valid)).not.toThrow();
    expect(() => validateTaskLists(createSettings({
      taskLists: [createTaskList({ id: "" })],
    }))).toThrow();
    expect(() => validateTaskLists(createSettings({
      taskLists: [createTaskList({ name: " " })],
    }))).toThrow();
    expect(() => validateTaskLists(createSettings({
      taskLists: [createTaskList({ activeFolder: "" })],
    }))).toThrow();
    expect(() => validateTaskLists(createSettings({
      taskLists: [
        createTaskList(),
        createTaskList({ id: "second", activeFolder: "Active/Nested" }),
      ],
    }))).toThrow();
    expect(() => validateTaskLists(createSettings({
      taskLists: [createTaskList({
        completionBehavior: { type: "move", completedFolder: "Active/Done" },
      })],
    }))).toThrow();
  });
});

describe("item classification", () => {
  it("normalizes configured, ISO and Date values", () => {
    const settings = createSettings({ dateFormat: "DD.MM.YYYY" });
    expect(normalizeDateId("12.08.2026", settings)).toBe("2026-08-12");
    expect(normalizeDateId("2026-08-12", settings)).toBe("2026-08-12");
    expect(normalizeDateId(new Date("2026-08-12T22:30:00Z"), settings)).toBe("2026-08-12");
    expect(normalizeDateId("2026-02-30", settings)).toBeNull();
    expect(normalizeDateId(null, settings)).toBeNull();
  });

  it("classifies dated notes inside their configured folder", () => {
    const app = new FakeApp();
    const settings = createSettings();
    const file = app.addFile("Notes/2026-08-12 - Meeting.md", {
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });

    expect(classifyItemFileDetailed(
      app as unknown as App,
      asFile(file),
      settings,
    )).toMatchObject({
      type: "item",
      item: { kind: "note", title: "Meeting", dateId: "2026-08-12" },
    });
  });

  it("reports invalid marked items and ignores unrelated files", () => {
    const app = new FakeApp();
    const settings = createSettings();
    const missingDate = app.addFile("Notes/Note.md", { vaultAgendaItem: "note" });
    const invalidDone = app.addFile("Active/Task.md", {
      vaultAgendaItem: "task",
      done: "false",
    });
    const unrelated = app.addFile("Elsewhere/Task.md", {
      vaultAgendaItem: "task",
      done: false,
    });
    const text = app.addFile("Notes/Text.txt", { vaultAgendaItem: "note", date: "2026-08-12" });

    expect(classifyItemFileDetailed(app as unknown as App, asFile(missingDate), settings).type)
      .toBe("invalid");
    expect(classifyItemFileDetailed(app as unknown as App, asFile(invalidDone), settings).type)
      .toBe("invalid");
    expect(classifyItemFileDetailed(app as unknown as App, asFile(unrelated), settings).type)
      .toBe("unrelated");
    expect(classifyItemFileDetailed(app as unknown as App, asFile(text), settings).type)
      .toBe("unrelated");
  });

  it("classifies scheduled and unscheduled tasks in both locations", () => {
    const app = new FakeApp();
    const settings = createSettings();
    const active = app.addFile("Active/2026-08-12 - Task.md", {
      vaultAgendaItem: "task",
      date: "2026-08-12",
      done: false,
      repeat: "weekly",
    });
    const completed = app.addFile("Completed/Task.md", {
      vaultAgendaItem: "task",
      done: true,
      completed: "2026-08-11",
      repeat: "daily",
    });

    expect(classifyItemFileDetailed(app as unknown as App, asFile(active), settings))
      .toMatchObject({
        type: "item",
        item: {
          kind: "task",
          title: "Task",
          taskLocation: "active",
          repeat: { frequency: "weekly" },
        },
      });
    expect(classifyItemFileDetailed(app as unknown as App, asFile(completed), settings))
      .toMatchObject({
        type: "item",
        item: {
          kind: "task",
          title: "Task",
          taskLocation: "completed",
          completedDateId: "2026-08-11",
        },
      });
  });
});
