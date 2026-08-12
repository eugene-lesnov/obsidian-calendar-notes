import type { App } from "obsidian";
import { describe, expect, it } from "vitest";

import {
  applyDateFormatMigration,
  planDateFormatMigration,
  rollbackDateFormatMigration,
} from "../src/data/dateFormatMigration";
import { createSettings } from "./fixtures";
import { FakeApp } from "./obsidian";

describe("date format migration", () => {
  it("produces an empty plan when the representation does not change", () => {
    const app = new FakeApp();
    const settings = createSettings();
    app.addFile("Notes/2026-08-12 - Note.md", {
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });

    expect(planDateFormatMigration(app as unknown as App, settings, "YYYY-MM-DD"))
      .toEqual({ entries: [], renameCount: 0, sample: null });
  });

  it("plans and applies frontmatter and filename changes", async () => {
    const app = new FakeApp();
    const settings = createSettings();
    const note = app.addFile("Notes/2026-08-12 - Note.md", {
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });
    const task = app.addFile("Active/2026-08-10 - Task.md", {
      vaultAgendaItem: "task",
      date: "2026-08-10",
      done: true,
      completed: "2026-08-11",
    });

    const plan = planDateFormatMigration(
      app as unknown as App,
      settings,
      "DD.MM.YYYY",
    );
    expect(plan.entries).toHaveLength(2);
    expect(plan.renameCount).toBe(2);
    expect(plan.sample).toEqual({ from: "2026-08-12", to: "12.08.2026" });

    const result = await applyDateFormatMigration(app as unknown as App, plan);
    expect(result).toEqual({ migrated: 2, renamed: 2, failures: [] });
    expect(note.path).toBe("Notes/12.08.2026 - Note.md");
    expect(task.path).toBe("Active/10.08.2026 - Task.md");
    expect(app.frontmatter.get(note)).toHaveProperty("date", "12.08.2026");
    expect(app.frontmatter.get(task)).toMatchObject({
      date: "10.08.2026",
      completed: "11.08.2026",
    });
  });

  it("does not rename an unsynchronized task filename", () => {
    const app = new FakeApp();
    const settings = createSettings();
    app.addFile("Active/Custom task.md", {
      vaultAgendaItem: "task",
      date: "2026-08-10",
      done: false,
    });

    const plan = planDateFormatMigration(
      app as unknown as App,
      settings,
      "DD.MM.YYYY",
    );

    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].targetPath).toBeNull();
    expect(plan.renameCount).toBe(0);
  });

  it("rolls back already-applied entries when a later target conflicts", async () => {
    const app = new FakeApp();
    const settings = createSettings();
    const first = app.addFile("Notes/2026-08-10 - First.md", {
      vaultAgendaItem: "note",
      date: "2026-08-10",
    });
    app.addFile("Notes/2026-08-11 - Second.md", {
      vaultAgendaItem: "note",
      date: "2026-08-11",
    });
    const plan = planDateFormatMigration(
      app as unknown as App,
      settings,
      "DD.MM.YYYY",
    );
    app.addFile("Notes/11.08.2026 - Second.md", {});

    const result = await applyDateFormatMigration(app as unknown as App, plan);

    expect(result.migrated).toBe(0);
    expect(result.renamed).toBe(0);
    expect(result.failures).not.toEqual([]);
    expect(first.path).toBe("Notes/2026-08-10 - First.md");
    expect(app.frontmatter.get(first)).toHaveProperty("date", "2026-08-10");
  });

  it("rejects a plan when frontmatter changed after planning", async () => {
    const app = new FakeApp();
    const settings = createSettings();
    const note = app.addFile("Notes/2026-08-12 - Note.md", {
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });
    const plan = planDateFormatMigration(
      app as unknown as App,
      settings,
      "DD.MM.YYYY",
    );
    app.frontmatter.get(note)!.date = "2026-08-13";

    const result = await applyDateFormatMigration(app as unknown as App, plan);

    expect(result.migrated).toBe(0);
    expect(result.failures).toContain(note.path);
    expect(note.path).toBe("Notes/2026-08-12 - Note.md");
    expect(app.frontmatter.get(note)).toHaveProperty("date", "2026-08-13");
  });

  it("can explicitly roll a successful migration back", async () => {
    const app = new FakeApp();
    const settings = createSettings();
    const note = app.addFile("Notes/2026-08-12 - Note.md", {
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });
    const plan = planDateFormatMigration(
      app as unknown as App,
      settings,
      "DD.MM.YYYY",
    );
    await applyDateFormatMigration(app as unknown as App, plan);

    expect(await rollbackDateFormatMigration(app as unknown as App, plan)).toEqual([]);
    expect(note.path).toBe("Notes/2026-08-12 - Note.md");
    expect(app.frontmatter.get(note)).toHaveProperty("date", "2026-08-12");
  });

  it("reports rollback failures without hiding them", async () => {
    const app = new FakeApp();
    const settings = createSettings();
    app.addFile("Notes/2026-08-12 - Note.md", {
      vaultAgendaItem: "note",
      date: "2026-08-12",
    });
    const plan = planDateFormatMigration(
      app as unknown as App,
      settings,
      "DD.MM.YYYY",
    );
    await applyDateFormatMigration(app as unknown as App, plan);
    app.failNextProcessFrontMatter = true;

    expect(await rollbackDateFormatMigration(app as unknown as App, plan))
      .toEqual(["Notes/12.08.2026 - Note.md"]);
  });
});
