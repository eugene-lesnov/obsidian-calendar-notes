import type { App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskOrder } from "../src/core/types";
import { classifyItemFile } from "../src/data/item";
import { setTaskCompleted } from "../src/data/taskCompletion";
import CalendarNotesPlugin from "../src/main";
import { addTask, createSettings, createTaskList } from "./fixtures";
import { FakeApp } from "./obsidian";

vi.mock("obsidian", async (importOriginal) => ({
  ...await importOriginal<typeof import("./obsidian")>(),
  getLanguage: () => "en",
  Plugin: class {
    constructor(readonly app: App) {}

    registerView(): void {}
    registerHoverLinkSource(): void {}
    addRibbonIcon(): void {}
    addCommand(): void {}
    addSettingTab(): void {}
    registerInterval(): void {}
    registerEvent(): void {}
    async loadData(): Promise<unknown> { return null; }
    async saveData(_settings: unknown): Promise<void> {}
  },
}));

vi.mock("../src/settings", () => ({ CalendarNotesSettingTab: class {} }));
vi.mock("../src/view/CalendarNotesView", () => ({ CalendarNotesView: class {} }));
vi.mock("../src/view/TaskListSetupModal", () => ({ TaskListSetupModal: class {} }));
vi.mock("../src/view/TaskListPickerModal", () => ({ TaskListPickerModal: class {} }));

function createEvents() {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();

  return {
    on(this: void, name: string, callback: (...args: unknown[]) => void): object {
      const callbacks = listeners.get(name) ?? [];
      callbacks.push(callback);
      listeners.set(name, callbacks);
      return {};
    },
    trigger(name: string, ...args: unknown[]): void {
      listeners.get(name)?.forEach((callback) => callback(...args));
    },
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });

  return { promise, resolve, reject };
}

function createPlugin(settings = createSettings()) {
  const app = new FakeApp();
  const vaultEvents = createEvents();
  const metadataEvents = createEvents();
  const layoutCallbacks: (() => void | Promise<void>)[] = [];
  const workspace = Object.assign(app.workspace, {
    layoutReady: false,
    getLeavesOfType: () => [],
    onLayoutReady: (callback: () => void | Promise<void>) => layoutCallbacks.push(callback),
  });
  Object.assign(app.vault, { on: vaultEvents.on });
  Object.assign(app.metadataCache, { on: metadataEvents.on });

  const renameFile = app.fileManager.renameFile;
  vi.spyOn(app.fileManager, "renameFile").mockImplementation(async (file, path) => {
    const oldPath = file.path;
    await renameFile(file, path);
    vaultEvents.trigger("rename", file, oldPath);
  });
  const processFrontMatter = app.fileManager.processFrontMatter;
  vi.spyOn(app.fileManager, "processFrontMatter").mockImplementation(async (file, update) => {
    await processFrontMatter(file, update);
    metadataEvents.trigger("changed", file);
  });

  const plugin = new CalendarNotesPlugin(app as unknown as App, {
    id: "calendar-notes",
    name: "Calendar Notes",
    description: "",
    author: "",
    version: "0.0.0",
    minAppVersion: "1.8.7",
  });
  vi.spyOn(plugin, "loadData").mockResolvedValue(settings);
  const saveData = vi.spyOn(plugin, "saveData").mockResolvedValue(undefined);

  return {
    app,
    plugin,
    saveData,
    vaultEvents,
    metadataEvents,
    load: async (): Promise<void> => {
      await plugin.onload();
    },
    ready: async (): Promise<void> => {
      workspace.layoutReady = true;

      for (const callback of layoutCallbacks) {
        await callback();
      }
    },
  };
}

describe("manual task order synchronization", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { setInterval: vi.fn().mockReturnValue(1) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<TaskOrder>(["manual", "title-asc"])(
    "cleans saved history on startup while preserving the remembered %s order",
    async (order) => {
      const settings = createSettings({ taskLists: [
        createTaskList({ order, completionBehavior: { type: "keep" } }),
        createTaskList({
          id: "other",
          name: "Other",
          activeFolder: "Other",
          completionBehavior: { type: "keep" },
        }),
      ] });
      const { app, plugin, saveData, load, ready, metadataEvents } = createPlugin(settings);
      const zebra = addTask(app, "Active/Zebra.md");
      const alpha = addTask(app, "Active/Alpha.md", { dateId: "2026-08-12" });
      const done = addTask(app, "Active/Done.md", { done: true });
      const other = addTask(app, "Other/Task.md", { taskListId: "other" });
      const outside = addTask(app, "Outside/Task.md");
      const unrelated = app.addFile("Active/Note.md", { calendarNotesItem: "note" });
      const invalid = app.addFile("Active/Invalid.md", { calendarNotesItem: "task" });
      const attachment = app.addFile("Active/Image.png", {});
      const folder = app.addFolder("Active/Folder");
      settings.taskLists[0].manualOrder = [
        zebra.file.path,
        done.file.path,
        "Active/Missing.md",
        other.file.path,
        outside.file.path,
        unrelated.path,
        invalid.path,
        attachment.path,
        folder.path,
        alpha.file.path,
        zebra.file.path,
      ];

      await load();
      expect(saveData).not.toHaveBeenCalled();
      await ready();

      const expectedOrder = [zebra.file.path, alpha.file.path];
      expect(plugin.settings.taskLists[0].manualOrder).toEqual(expectedOrder);
      expect(saveData).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        taskLists: [expect.objectContaining({ order, manualOrder: expectedOrder }),
          expect.objectContaining({ id: "other", manualOrder: [] })],
      }));
      expect(app.frontmatter.get(done.file)).toHaveProperty("done", true);
      expect(app.processFrontMatterCount).toBe(0);
      expect(app.renameCount).toBe(0);

      metadataEvents.trigger("resolved");
      await Promise.resolve();
      expect(saveData).toHaveBeenCalledTimes(1);
    },
  );

  it("does not accumulate completed tasks that remain in the active folder", async () => {
    const settings = createSettings({ taskLists: [createTaskList({
      order: "manual",
      completionBehavior: { type: "keep" },
    })] });
    const { app, plugin, saveData, load, ready, vaultEvents } = createPlugin(settings);
    const anchor = addTask(app, "Active/Anchor.md");
    settings.taskLists[0].manualOrder = [anchor.file.path];
    await load();
    await ready();

    for (let index = 0; index < 10; index += 1) {
      const task = addTask(app, `Active/Task ${index}.md`);
      vaultEvents.trigger("create", task.file);
      expect(plugin.settings.taskLists[0].manualOrder).toContain(task.file.path);

      await setTaskCompleted(app as unknown as App, plugin.settings, task, true);

      expect(plugin.settings.taskLists[0].manualOrder).toEqual([anchor.file.path]);
      expect(app.vault.getAbstractFileByPath(task.file.path)).toBe(task.file);
    }

    await vi.waitFor(() => expect(saveData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        taskLists: [expect.objectContaining({ manualOrder: [anchor.file.path] })],
      }),
    ));
  });

  it.each([
    { completion: "keep", position: "start" },
    { completion: "keep", position: "end" },
    { completion: "move", position: "start" },
    { completion: "move", position: "end" },
  ] as const)(
    "removes completed tasks in $completion mode and reopens them at the $position",
    async ({ completion, position }) => {
      const settings = createSettings({ taskLists: [createTaskList({
        order: "manual",
        newTaskPosition: position,
        completionBehavior: completion === "keep"
          ? { type: "keep" }
          : { type: "move", completedFolder: "Completed" },
      })] });
      const { app, plugin, load, ready } = createPlugin(settings);
      const zebra = addTask(app, "Active/Zebra.md");
      const task = addTask(app, "Active/Task.md");
      const alpha = addTask(app, "Active/Alpha.md");
      settings.taskLists[0].manualOrder = [zebra.file.path, task.file.path, alpha.file.path];
      await load();
      await ready();

      await setTaskCompleted(app as unknown as App, plugin.settings, task, true);

      expect(plugin.settings.taskLists[0].manualOrder)
        .toEqual([zebra.file.path, alpha.file.path]);
      expect(task.file.path).toBe(completion === "keep" ? "Active/Task.md" : "Completed/Task.md");
      const completed = classifyItemFile(app as unknown as App, task.file, plugin.settings);
      expect(completed?.kind).toBe("task");

      if (completed?.kind !== "task") {
        throw new Error("Completed task was not indexed");
      }

      await setTaskCompleted(app as unknown as App, plugin.settings, completed, false);

      const remaining = [zebra.file.path, alpha.file.path];
      expect(task.file.path).toBe("Active/Task.md");
      expect(plugin.settings.taskLists[0].manualOrder).toEqual(position === "start"
        ? [task.file.path, ...remaining]
        : [...remaining, task.file.path]);
    },
  );

  it("keeps the position of a renamed active task", async () => {
    const settings = createSettings({ taskLists: [createTaskList({ order: "manual" })] });
    const { app, plugin, load, ready } = createPlugin(settings);
    const zebra = addTask(app, "Active/Zebra.md");
    const alpha = addTask(app, "Active/Alpha.md");
    settings.taskLists[0].manualOrder = [zebra.file.path, alpha.file.path];
    await load();
    await ready();

    await app.fileManager.renameFile(zebra.file, "Active/Renamed.md");

    expect(plugin.settings.taskLists[0].manualOrder)
      .toEqual(["Active/Renamed.md", alpha.file.path]);
  });

  it("retains uncached files until metadata is available and then cleans them once", async () => {
    const settings = createSettings({ taskLists: [createTaskList({ order: "manual" })] });
    const { app, plugin, saveData, load, ready, metadataEvents } = createPlugin(settings);
    const active = addTask(app, "Active/Active.md");
    const pending = addTask(app, "Active/Pending.md", { done: true });
    const frontmatter = app.frontmatter.get(pending.file)!;
    app.frontmatter.delete(pending.file);
    settings.taskLists[0].manualOrder = [pending.file.path, active.file.path];
    await load();
    await ready();

    expect(plugin.settings.taskLists[0].manualOrder)
      .toEqual([pending.file.path, active.file.path]);
    expect(saveData).not.toHaveBeenCalled();

    app.frontmatter.set(pending.file, frontmatter);
    metadataEvents.trigger("changed", pending.file);
    metadataEvents.trigger("resolved");

    expect(plugin.settings.taskLists[0].manualOrder).toEqual([active.file.path]);
    await vi.waitFor(() => expect(saveData).toHaveBeenCalledTimes(1));
    metadataEvents.trigger("resolved");
    await Promise.resolve();
    expect(saveData).toHaveBeenCalledTimes(1);
  });

  it("preserves the previous folder's order if saving a new folder fails", async () => {
    const settings = createSettings({ taskLists: [createTaskList({ order: "manual" })] });
    const { app, plugin, saveData, load, ready, metadataEvents } = createPlugin(settings);
    const task = addTask(app, "Active/Task.md");
    settings.taskLists[0].manualOrder = [task.file.path];
    await load();
    await ready();
    const pendingSave = deferred();
    saveData.mockReturnValueOnce(pendingSave.promise);
    const taskList = plugin.settings.taskLists[0];
    taskList.activeFolder = "New active";

    const saving = expect(plugin.saveSettingsAndReindex()).rejects.toThrow("Save failed");
    await vi.waitFor(() => expect(saveData).toHaveBeenCalledTimes(1));
    metadataEvents.trigger("resolved");
    expect(taskList.manualOrder).toEqual([task.file.path]);

    pendingSave.reject(new Error("Save failed"));
    await saving;
    taskList.activeFolder = "Active";
    expect(taskList.manualOrder).toEqual([task.file.path]);

    await plugin.saveSettingsAndReindex();

    expect(saveData).toHaveBeenLastCalledWith(expect.objectContaining({
      taskLists: [expect.objectContaining({ activeFolder: "Active", manualOrder: [task.file.path] })],
    }));
  });

  it("cleans paths from the previous active folder after a successful settings save", async () => {
    const settings = createSettings({ taskLists: [createTaskList({ order: "manual" })] });
    const { app, plugin, saveData, load, ready } = createPlugin(settings);
    const task = addTask(app, "Active/Task.md");
    settings.taskLists[0].manualOrder = [task.file.path];
    await load();
    await ready();
    plugin.settings.taskLists[0].activeFolder = "New active";

    await plugin.saveSettingsAndReindex();

    expect(plugin.settings.taskLists[0].manualOrder).toEqual([]);
    expect(saveData).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      taskLists: [expect.objectContaining({ activeFolder: "New active", manualOrder: [] })],
    }));
  });

  it.each(["saveSettings", "saveSettingsAndReindex"] as const)(
    "persists completion that arrives while %s is in progress",
    async (saveMethod) => {
      const settings = createSettings({ taskLists: [createTaskList({
        order: "manual",
        completionBehavior: { type: "keep" },
      })] });
      const { app, plugin, saveData, load, ready, metadataEvents } = createPlugin(settings);
      const anchor = addTask(app, "Active/Anchor.md");
      const task = addTask(app, "Active/Task.md");
      settings.taskLists[0].manualOrder = [anchor.file.path, task.file.path];
      await load();
      await ready();
      const pendingSave = deferred();
      saveData.mockReturnValueOnce(pendingSave.promise);

      const saving = plugin[saveMethod]();
      await vi.waitFor(() => expect(saveData).toHaveBeenCalledTimes(1));
      Object.assign(app.frontmatter.get(task.file)!, { done: true, completed: "2026-08-12" });
      pendingSave.resolve();
      await saving;
      metadataEvents.trigger("changed", task.file);

      await vi.waitFor(() => expect(saveData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          taskLists: [expect.objectContaining({ manualOrder: [anchor.file.path] })],
        }),
      ));
      expect(saveData).toHaveBeenCalledTimes(2);
      expect(plugin.settings.taskLists[0].manualOrder).toEqual([anchor.file.path]);
    },
  );
});
