import { afterEach, describe, expect, it } from "vitest";

import { setLocale } from "../src/core/localization";
import { getRepeatOccurrenceMeta } from "../src/view/taskListsSection";
import { addTask } from "./fixtures";
import { FakeApp } from "./obsidian";

describe("task list repeat metadata", () => {
  afterEach(() => setLocale("en"));

  it("omits a date already displayed in the filename", () => {
    setLocale("en");
    const app = new FakeApp();
    const task = addTask(app, "Active/2026-09-08 - Holiday.md", {
      dateId: "2026-09-08",
      repeat: "yearly",
    });

    expect(getRepeatOccurrenceMeta(task, "2026-08-28", (dateId) => dateId))
      .toEqual({ text: "Every year · Scheduled", overdue: false });
  });

  it("keeps the next date when it is absent from the filename", () => {
    setLocale("en");
    const app = new FakeApp();
    const task = addTask(app, "Active/Holiday.md", {
      dateId: "2026-09-08",
      repeat: "yearly",
    });

    expect(getRepeatOccurrenceMeta(task, "2026-08-28", (dateId) => dateId))
      .toEqual({ text: "Every year · Next: 2026-09-08", overdue: false });
  });

  it("keeps today and overdue statuses without duplicating the filename date", () => {
    setLocale("en");
    const app = new FakeApp();
    const today = addTask(app, "Active/2026-08-28 - Today.md", {
      dateId: "2026-08-28",
      repeat: "daily",
    });
    const overdue = addTask(app, "Active/2026-08-27 - Overdue.md", {
      dateId: "2026-08-27",
      repeat: "daily",
    });

    expect(getRepeatOccurrenceMeta(today, "2026-08-28", (dateId) => dateId))
      .toEqual({ text: "Every day · Today", overdue: false });
    expect(getRepeatOccurrenceMeta(overdue, "2026-08-28", (dateId) => dateId))
      .toEqual({ text: "Every day · Overdue", overdue: true });
  });
});
