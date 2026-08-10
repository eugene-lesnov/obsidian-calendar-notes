import { App, TAbstractFile, TFile, TFolder } from "obsidian";

import type { CalendarSettings } from "../core/types";
import type { Item, Task } from "./item";
import { classifyItemFile } from "./item";
import { configuredScopeFolders } from "./itemScopes";

export type CalendarDayCounts = {
  notes: number;
  tasks: number;
  hasActiveTasks: boolean;
};

export type ItemUpsertResult = {
  changed: boolean;
  previous: Item | null;
  current: Item | null;
};

function compareTitles(first: Item, second: Item): number {
  return first.title.localeCompare(second.title, undefined, { numeric: true });
}

function compareDayItems(first: Item, second: Item): number {
  if (first.kind === "task" && second.kind === "task" && first.done !== second.done) {
    return first.done ? 1 : -1;
  }

  return compareTitles(first, second);
}

function compareOverdueTasks(first: Task, second: Task): number {
  if (first.dateId !== second.dateId) {
    return (first.dateId ?? "").localeCompare(second.dateId ?? "");
  }

  return compareTitles(first, second);
}

function sameItem(first: Item, second: Item): boolean {
  if (
    first.kind !== second.kind
    || first.file.path !== second.file.path
    || first.title !== second.title
    || first.dateId !== second.dateId
  ) {
    return false;
  }

  if (first.kind === "note" || second.kind === "note") {
    return true;
  }

  return first.done === second.done
    && first.completedDateId === second.completedDateId
    && first.repeat?.frequency === second.repeat?.frequency
    && first.taskListId === second.taskListId
    && first.taskLocation === second.taskLocation;
}

export class ItemIndex {
  private readonly itemsByDate = new Map<string, Item[]>();
  private readonly itemsByPath = new Map<string, Item>();
  private readonly activeTasksByListId = new Map<string, Task[]>();
  private readonly datesWithActiveTasks = new Set<string>();

  constructor(
    private readonly app: App,
    private readonly getSettings: () => CalendarSettings,
  ) {}

  rebuild(): void {
    this.itemsByDate.clear();
    this.itemsByPath.clear();
    this.activeTasksByListId.clear();
    this.datesWithActiveTasks.clear();
    this.getFilesInScope().forEach((file) => this.addFile(file));
  }

  getItemsByDate(dateId: string): Item[] {
    return this.itemsByDate.get(dateId) ?? [];
  }

  getActiveTasks(taskListId: string): Task[] {
    return this.activeTasksByListId.get(taskListId) ?? [];
  }

  getDayCounts(dateId: string): CalendarDayCounts {
    const items = this.itemsByDate.get(dateId) ?? [];
    let notes = 0;
    let tasks = 0;
    let hasActiveTasks = false;

    items.forEach((item) => {
      if (item.kind === "note") {
        notes += 1;
      } else {
        tasks += 1;
        hasActiveTasks ||= !item.done;
      }
    });

    return { notes, tasks, hasActiveTasks };
  }

  getOverdueTasks(
    todayDateId: string,
    options: { excludeDateId?: string; limit?: number } = {},
  ): { items: Task[]; total: number } {
    const overdue: Task[] = [];

    Array.from(this.datesWithActiveTasks)
      .filter((dateId) => dateId < todayDateId && dateId !== options.excludeDateId)
      .sort()
      .forEach((dateId) => {
        this.itemsByDate.get(dateId)?.forEach((item) => {
          if (item.kind === "task" && !item.done) {
            overdue.push(item);
          }
        });
      });

    overdue.sort(compareOverdueTasks);

    return {
      items: options.limit === undefined ? overdue : overdue.slice(0, options.limit),
      total: overdue.length,
    };
  }

  upsert(file: TAbstractFile): ItemUpsertResult {
    if (!(file instanceof TFile)) {
      return { changed: false, previous: null, current: null };
    }

    const previous = this.itemsByPath.get(file.path) ?? null;
    const current = classifyItemFile(this.app, file, this.getSettings());

    if (previous && current && sameItem(previous, current)) {
      return { changed: false, previous, current };
    }

    const removed = this.removeByPath(file.path);

    if (current) {
      this.insert(current);
    }

    return { changed: removed || Boolean(current), previous, current };
  }

  remove(path: string): ItemUpsertResult {
    const previous = this.itemsByPath.get(path) ?? null;

    return { changed: this.removeByPath(path), previous, current: null };
  }

  rename(file: TAbstractFile, oldPath: string): ItemUpsertResult {
    const previous = this.itemsByPath.get(oldPath) ?? null;
    const removed = this.removeByPath(oldPath);
    const added = this.addFile(file);
    const current = file instanceof TFile ? this.itemsByPath.get(file.path) ?? null : null;

    return { changed: removed || added, previous, current };
  }

  private getFilesInScope(): TFile[] {
    const files = new Map<string, TFile>();

    configuredScopeFolders(this.getSettings()).forEach((path) => {
      if (path === "/") {
        this.app.vault.getMarkdownFiles().forEach((file) => files.set(file.path, file));

        return;
      }

      const root = this.app.vault.getAbstractFileByPath(path);

      if (root instanceof TFolder) {
        this.collectFolderFiles(root, files);
      }
    });

    return Array.from(files.values());
  }

  private collectFolderFiles(root: TFolder, files: Map<string, TFile>): void {
    const folders = [root];

    while (folders.length > 0) {
      const folder = folders.pop();

      folder?.children.forEach((child) => {
        if (child instanceof TFolder) {
          folders.push(child);
        } else if (child instanceof TFile && child.extension === "md") {
          files.set(child.path, child);
        }
      });
    }
  }

  private addFile(file: TAbstractFile): boolean {
    if (!(file instanceof TFile)) {
      return false;
    }

    const item = classifyItemFile(this.app, file, this.getSettings());

    if (!item) {
      return false;
    }

    this.insert(item);

    return true;
  }

  private insert(item: Item): void {
    this.itemsByPath.set(item.file.path, item);

    if (item.dateId) {
      const dayItems = this.itemsByDate.get(item.dateId) ?? [];
      dayItems.push(item);
      dayItems.sort(compareDayItems);
      this.itemsByDate.set(item.dateId, dayItems);

      if (item.kind === "task" && !item.done) {
        this.datesWithActiveTasks.add(item.dateId);
      }
    }

    if (item.kind === "task" && !item.done && item.taskLocation === "active") {
      const tasks = this.activeTasksByListId.get(item.taskListId) ?? [];
      tasks.push(item);
      tasks.sort(compareTitles);
      this.activeTasksByListId.set(item.taskListId, tasks);
    }
  }

  private removeByPath(path: string): boolean {
    const item = this.itemsByPath.get(path);

    if (!item) {
      return false;
    }

    this.itemsByPath.delete(path);

    if (item.dateId) {
      const remaining = (this.itemsByDate.get(item.dateId) ?? [])
        .filter((entry) => entry !== item);

      if (remaining.length > 0) {
        this.itemsByDate.set(item.dateId, remaining);
      } else {
        this.itemsByDate.delete(item.dateId);
      }

      if (remaining.some((entry) => entry.kind === "task" && !entry.done)) {
        this.datesWithActiveTasks.add(item.dateId);
      } else {
        this.datesWithActiveTasks.delete(item.dateId);
      }
    }

    if (item.kind === "task" && !item.done && item.taskLocation === "active") {
      const remaining = (this.activeTasksByListId.get(item.taskListId) ?? [])
        .filter((entry) => entry !== item);

      if (remaining.length > 0) {
        this.activeTasksByListId.set(item.taskListId, remaining);
      } else {
        this.activeTasksByListId.delete(item.taskListId);
      }
    }

    return true;
  }
}
