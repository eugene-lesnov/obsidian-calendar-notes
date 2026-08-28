import type { App } from "obsidian";
import { describe, expect, it } from "vitest";

import {
  applyTaskFilenameMigration,
  planTaskFilenameMigration,
  rollbackTaskFilenameMigration,
} from "../src/data/taskFilenameMigration";
import { createSettings } from "./fixtures";
import { FakeApp } from "./obsidian";

describe("task filename migration", () => {
  it("preserves a date-like prefix that does not match frontmatter", () => {
    const app = new FakeApp();
    const settings = createSettings();
    app.addFile("Active/2025-01-01 - History.md", {
      vaultAgendaItem: "task",
      date: "2026-08-12",
      done: false,
    });

    const plan = planTaskFilenameMigration(app as unknown as App, settings, true);

    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].targetName)
      .toBe("2026-08-12 - 2025-01-01 - History");
  });

  it("applies and rolls back filename synchronization without replacing quotes", async () => {
    const app = new FakeApp();
    const settings = createSettings();
    const file = app.addFile('Active/Task "Owner".md', {
      vaultAgendaItem: "task",
      date: "2026-08-12",
      done: false,
    });
    const plan = planTaskFilenameMigration(app as unknown as App, settings, true);

    expect(await applyTaskFilenameMigration(
      app as unknown as App,
      settings,
      true,
      plan,
    )).toEqual({ renamed: 1, failures: [] });
    expect(file.path).toBe('Active/2026-08-12 - Task "Owner".md');

    expect(await rollbackTaskFilenameMigration(app as unknown as App, plan)).toEqual([]);
    expect(file.path).toBe('Active/Task "Owner".md');
  });

  it("uses a unique path when a migration target already exists", async () => {
    const app = new FakeApp();
    const settings = createSettings();
    const file = app.addFile("Active/Task.md", {
      vaultAgendaItem: "task",
      date: "2026-08-12",
      done: false,
    });
    app.addFile("Active/2026-08-12 - Task.md", {});
    const plan = planTaskFilenameMigration(app as unknown as App, settings, true);

    const result = await applyTaskFilenameMigration(
      app as unknown as App,
      settings,
      true,
      plan,
    );

    expect(result).toEqual({ renamed: 1, failures: [] });
    expect(file.path).toBe("Active/2026-08-12 - Task (2).md");
  });

  it("removes only a prefix synchronized with the task date", () => {
    const app = new FakeApp();
    const settings = createSettings({ syncTaskDateWithFilename: true });
    app.addFile("Active/2026-08-12 - Synchronized.md", {
      vaultAgendaItem: "task",
      date: "2026-08-12",
      done: false,
    });
    app.addFile("Active/2025-01-01 - History.md", {
      vaultAgendaItem: "task",
      date: "2026-08-12",
      done: false,
    });

    const plan = planTaskFilenameMigration(app as unknown as App, settings, false);

    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]).toMatchObject({ targetName: "Synchronized" });
  });

  it("rejects a task changed after planning", async () => {
    const app = new FakeApp();
    const settings = createSettings();
    const file = app.addFile("Active/Task.md", {
      vaultAgendaItem: "task",
      date: "2026-08-12",
      done: false,
    });
    const plan = planTaskFilenameMigration(app as unknown as App, settings, true);
    app.frontmatter.get(file)!.date = "2026-08-13";

    const result = await applyTaskFilenameMigration(
      app as unknown as App,
      settings,
      true,
      plan,
    );

    expect(result.renamed).toBe(0);
    expect(result.failures).toEqual(["Active/Task.md"]);
    expect(file.path).toBe("Active/Task.md");
  });

  it("rolls back applied entries when a later task changed", async () => {
    const app = new FakeApp();
    const settings = createSettings();
    const first = app.addFile("Active/First.md", {
      vaultAgendaItem: "task",
      date: "2026-08-12",
      done: false,
    });
    const second = app.addFile("Active/Second.md", {
      vaultAgendaItem: "task",
      date: "2026-08-13",
      done: false,
    });
    const plan = planTaskFilenameMigration(app as unknown as App, settings, true);
    app.frontmatter.get(second)!.date = "2026-08-14";

    const result = await applyTaskFilenameMigration(
      app as unknown as App,
      settings,
      true,
      plan,
    );

    expect(result.renamed).toBe(0);
    expect(result.failures).toEqual(["Active/Second.md"]);
    expect(first.path).toBe("Active/First.md");
    expect(second.path).toBe("Active/Second.md");
  });
});
