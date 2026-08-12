import { describe, expect, it } from "vitest";

import { initializeManualOrder, orderTasks } from "../src/data/taskOrdering";
import { addTask, createTaskList } from "./fixtures";
import { FakeApp } from "./obsidian";

describe("task ordering", () => {
  it("orders titles naturally in both directions without mutating input", () => {
    const app = new FakeApp();
    const tasks = [
      addTask(app, "Active/Task 10.md"),
      addTask(app, "Active/Task 2.md"),
      addTask(app, "Active/Alpha.md"),
    ];
    const original = [...tasks];

    expect(orderTasks(createTaskList({ order: "title-asc" }), tasks).map((task) => task.title))
      .toEqual(["Alpha", "Task 2", "Task 10"]);
    expect(orderTasks(createTaskList({ order: "title-desc" }), tasks).map((task) => task.title))
      .toEqual(["Task 10", "Task 2", "Alpha"]);
    expect(tasks).toEqual(original);
  });

  it("orders scheduled tasks by date and leaves unscheduled tasks last", () => {
    const app = new FakeApp();
    const tasks = [
      addTask(app, "Active/None.md"),
      addTask(app, "Active/Later.md", { dateId: "2026-08-20" }),
      addTask(app, "Active/Sooner.md", { dateId: "2026-08-10" }),
    ];

    expect(orderTasks(createTaskList({ order: "date-asc" }), tasks).map((task) => task.title))
      .toEqual(["Sooner", "Later", "None"]);
    expect(orderTasks(createTaskList({ order: "date-desc" }), tasks).map((task) => task.title))
      .toEqual(["Later", "Sooner", "None"]);
  });

  it("honors manual positions and appends unknown tasks by title", () => {
    const app = new FakeApp();
    const beta = addTask(app, "Active/Beta.md");
    const alpha = addTask(app, "Active/Alpha.md");
    const known = addTask(app, "Active/Known.md");
    const list = createTaskList({
      order: "manual",
      manualOrder: [known.file.path],
    });

    expect(orderTasks(list, [beta, known, alpha]).map((task) => task.title))
      .toEqual(["Known", "Alpha", "Beta"]);
    expect(initializeManualOrder(list, [beta, known, alpha]))
      .toEqual([known.file.path, alpha.file.path, beta.file.path]);
    expect(initializeManualOrder(createTaskList({ order: "title-asc" }), [beta, alpha]))
      .toEqual([alpha.file.path, beta.file.path]);
  });
});
