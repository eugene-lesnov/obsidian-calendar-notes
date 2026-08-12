import type { App, TAbstractFile } from "obsidian";
import { describe, expect, it } from "vitest";

import { ItemIndex } from "../src/data/itemIndex";
import { createSettings } from "./fixtures";
import { FakeApp } from "./obsidian";

function asAbstractFile(file: import("./obsidian").TFile): TAbstractFile {
  return file as unknown as TAbstractFile;
}

describe("ItemIndex", () => {
  it("rebuilds date, active-list and overdue indexes", () => {
    const app = new FakeApp();
    const settings = createSettings();
    app.addFile("Notes/2026-08-12 - Note.md", {
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });
    app.addFile("Active/2026-08-10 - Zebra.md", {
      vaultAgendaItem: "task",
      date: "2026-08-10",
      done: false,
    });
    app.addFile("Active/2026-08-10 - Alpha.md", {
      vaultAgendaItem: "task",
      date: "2026-08-10",
      done: false,
    });
    app.addFile("Active/Unscheduled.md", {
      vaultAgendaItem: "task",
      done: false,
    });
    app.addFile("Completed/2026-08-11 - Done.md", {
      vaultAgendaItem: "task",
      date: "2026-08-11",
      done: true,
    });
    app.addFile("Outside/Ignored.md", {
      vaultAgendaItem: "task",
      done: false,
    });
    const index = new ItemIndex(app as unknown as App, () => settings);

    index.rebuild();

    expect(index.getDayCounts("2026-08-12")).toEqual({
      notes: 1,
      tasks: 0,
      hasActiveTasks: false,
    });
    expect(index.getDayCounts("2026-08-10")).toEqual({
      notes: 0,
      tasks: 2,
      hasActiveTasks: true,
    });
    expect(index.getActiveTasks("list").map((task) => task.title))
      .toEqual(["Alpha", "Unscheduled", "Zebra"]);
    expect(index.getOverdueTasks("2026-08-12", { limit: 1 })).toMatchObject({
      total: 2,
      items: [{ title: "Alpha" }],
    });
    expect(index.getOverdueTasks("2026-08-12", { excludeDateId: "2026-08-10" }))
      .toEqual({ total: 0, items: [] });
  });

  it("upserts changed metadata and ignores equivalent snapshots", () => {
    const app = new FakeApp();
    const settings = createSettings();
    const file = app.addFile("Active/2026-08-12 - Task.md", {
      vaultAgendaItem: "task",
      date: "2026-08-12",
      done: false,
    });
    const index = new ItemIndex(app as unknown as App, () => settings);

    expect(index.upsert(asAbstractFile(file))).toMatchObject({ changed: true, previous: null });
    expect(index.upsert(asAbstractFile(file)).changed).toBe(false);
    app.frontmatter.get(file)!.done = true;
    const changed = index.upsert(asAbstractFile(file));
    expect(changed.changed).toBe(true);
    expect(changed.previous).toMatchObject({ done: false });
    expect(changed.current).toMatchObject({ done: true });
    expect(index.getDayCounts("2026-08-12").hasActiveTasks).toBe(false);
    expect(index.getActiveTasks("list")).toEqual([]);
  });

  it("removes and renames indexed files incrementally", async () => {
    const app = new FakeApp();
    const settings = createSettings();
    const file = app.addFile("Active/Task.md", {
      vaultAgendaItem: "task",
      done: false,
    });
    const index = new ItemIndex(app as unknown as App, () => settings);
    index.upsert(asAbstractFile(file));

    await app.fileManager.renameFile(file, "Active/Renamed.md");
    const renamed = index.rename(asAbstractFile(file), "Active/Task.md");
    expect(renamed.changed).toBe(true);
    expect(renamed.previous).toMatchObject({ title: "Task" });
    expect(renamed.current).toMatchObject({ title: "Renamed" });
    expect(index.getActiveTasks("list").map((task) => task.title)).toEqual(["Renamed"]);

    expect(index.remove(file.path)).toMatchObject({ changed: true });
    expect(index.remove(file.path)).toEqual({ changed: false, previous: null, current: null });
    expect(index.getActiveTasks("list")).toEqual([]);
  });
});
