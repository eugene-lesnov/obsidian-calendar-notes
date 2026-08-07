import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";

import type { CalendarSettings } from "../core/types";
import type { CalendarItem } from "./calendarItem";
import { classifyFile } from "./calendarItem";
import { joinPath } from "./folders";

export type CalendarDayCounts = {
  notes: number;
  tasks: number;
  hasOpenTasks: boolean;
};

export type CalendarUpsertResult = {
  changed: boolean;
  completedTask?: CalendarItem;
};

function isOpenTask(item: CalendarItem): boolean {
  return item.kind === "task" && !item.done;
}

function compareItems(first: CalendarItem, second: CalendarItem): number {
  if (first.done !== second.done) {
    return first.done ? 1 : -1;
  }

  return first.title.localeCompare(second.title, undefined, { numeric: true });
}

function compareOverdueItems(first: CalendarItem, second: CalendarItem): number {
  if (first.dateId !== second.dateId) {
    return first.dateId < second.dateId ? -1 : 1;
  }

  return first.title.localeCompare(second.title, undefined, { numeric: true });
}

function sameRepeat(first: CalendarItem, second: CalendarItem): boolean {
  return first.repeat?.frequency === second.repeat?.frequency;
}

function sameCalendarState(first: CalendarItem, second: CalendarItem): boolean {
  return first.file.path === second.file.path
    && first.title === second.title
    && first.dateId === second.dateId
    && first.kind === second.kind
    && first.done === second.done
    && first.completed === second.completed
    && sameRepeat(first, second);
}

export class CalendarIndex {
  private readonly app: App;
  private readonly getSettings: () => CalendarSettings;
  private readonly itemsByDate = new Map<string, CalendarItem[]>();
  private readonly itemsByPath = new Map<string, CalendarItem>();
  private readonly datesWithOpenTasks = new Set<string>();

  constructor(app: App, getSettings: () => CalendarSettings) {
    this.app = app;
    this.getSettings = getSettings;
  }

  rebuild(): void {
    this.itemsByDate.clear();
    this.itemsByPath.clear();
    this.datesWithOpenTasks.clear();
    this.getFilesInScope().forEach((file) => this.addFile(file));
  }

  getItems(dateId: string): CalendarItem[] {
    return this.itemsByDate.get(dateId) ?? [];
  }


  getCounts(dateId: string): CalendarDayCounts {
    const items = this.itemsByDate.get(dateId);

    if (!items) {
      return { notes: 0, tasks: 0, hasOpenTasks: false };
    }

    let notes = 0;
    let tasks = 0;
    let hasOpenTasks = false;

    for (const item of items) {
      if (item.kind === "note") {
        notes += 1;
        continue;
      }

      tasks += 1;

      if (isOpenTask(item)) {
        hasOpenTasks = true;
      }
    }

    return { notes, tasks, hasOpenTasks };
  }

  getOverdueTasks(
    todayDateId: string,
    options: { excludeDateId?: string; limit?: number } = {},
  ): { items: CalendarItem[]; total: number } {
    const overdue: CalendarItem[] = [];
    let total = 0;
    const dates = Array.from(this.datesWithOpenTasks)
      .filter((dateId) => dateId < todayDateId && dateId !== options.excludeDateId)
      .sort();

    dates.forEach((dateId) => {
      this.itemsByDate.get(dateId)?.forEach((item) => {
        if (isOpenTask(item)) {
          total += 1;

          if (options.limit === undefined || overdue.length < options.limit) {
            overdue.push(item);
          }
        }
      });
    });

    return { items: overdue.sort(compareOverdueItems), total };
  }

  upsert(file: TAbstractFile): CalendarUpsertResult {
    if (!(file instanceof TFile)) {
      return { changed: false };
    }

    const previous = this.itemsByPath.get(file.path) ?? null;
    const current = classifyFile(this.app, file, this.getSettings());
    const completedTask = previous && current && !previous.done && current.done ? current : null;

    if (previous && current && sameCalendarState(previous, current)) {
      return { changed: false, ...(completedTask ? { completedTask } : {}) };
    }

    const removed = this.removeByPath(file.path);

    if (current) {
      this.itemsByPath.set(file.path, current);
      this.insert(current);
    }

    return { changed: removed || Boolean(current), ...(completedTask ? { completedTask } : {}) };
  }

  remove(path: string): boolean {
    return this.removeByPath(path);
  }

  rename(file: TAbstractFile, oldPath: string): boolean {
    const removed = this.removeByPath(oldPath);
    const added = this.addFile(file);

    return removed || added;
  }

  private getFilesInScope(): TFile[] {
    const folderPath = normalizePath(joinPath(this.getSettings().calendarItemsFolder));

    if (!folderPath || folderPath === "/") {
      return this.app.vault.getMarkdownFiles();
    }

    const root = this.app.vault.getAbstractFileByPath(folderPath);

    if (!(root instanceof TFolder)) {
      return [];
    }

    const files: TFile[] = [];
    const folders = [root];

    while (folders.length > 0) {
      const folder = folders.pop();

      if (!folder) {
        continue;
      }

      folder.children.forEach((child) => {
        if (child instanceof TFolder) {
          folders.push(child);
        } else if (child instanceof TFile && child.extension === "md") {
          files.push(child);
        }
      });
    }

    return files;
  }

  private addFile(file: TAbstractFile): boolean {
    if (!(file instanceof TFile)) {
      return false;
    }

    const item = classifyFile(this.app, file, this.getSettings());

    if (!item) {
      return false;
    }

    this.itemsByPath.set(file.path, item);
    this.insert(item);

    return true;
  }

  private insert(item: CalendarItem): void {
    const items = this.itemsByDate.get(item.dateId);

    if (!items) {
      this.itemsByDate.set(item.dateId, [item]);
    } else {
      items.push(item);
      items.sort(compareItems);
    }

    if (isOpenTask(item)) {
      this.datesWithOpenTasks.add(item.dateId);
    }
  }

  private removeByPath(path: string): boolean {
    const item = this.itemsByPath.get(path);

    if (!item) {
      return false;
    }

    this.itemsByPath.delete(path);

    const dateId = item.dateId;
    const dayItems = this.itemsByDate.get(dateId);

    if (!dayItems) {
      return true;
    }

    const remaining = dayItems.filter((entry) => entry !== item);

    if (remaining.length === 0) {
      this.itemsByDate.delete(dateId);
      this.datesWithOpenTasks.delete(dateId);

      return true;
    }

    this.itemsByDate.set(dateId, remaining);

    if (remaining.some(isOpenTask)) {
      this.datesWithOpenTasks.add(dateId);
    } else {
      this.datesWithOpenTasks.delete(dateId);
    }

    return true;
  }
}
