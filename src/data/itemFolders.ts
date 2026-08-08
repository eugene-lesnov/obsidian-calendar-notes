import { TFile, normalizePath } from "obsidian";

import strings from "../core/localization";
import type { CalendarSettings } from "../core/types";
import type { CalendarItemKind } from "./calendarItem";
import { joinPath } from "./folders";

export function itemFolder(settings: CalendarSettings, kind: CalendarItemKind): string {
  return kind === "task" ? settings.activeTasksFolder : settings.notesFolder;
}

export function taskFolder(settings: CalendarSettings, done: boolean): string {
  return done ? settings.completedTasksFolder : settings.activeTasksFolder;
}

export function isFileInsideFolder(file: TFile, configuredPath: string): boolean {
  const folder = normalizePath(joinPath(configuredPath));

  return folder === "/" || file.path.startsWith(`${folder}/`);
}

export function isFileInItemScope(
  file: TFile,
  settings: CalendarSettings,
  kind: CalendarItemKind,
): boolean {
  if (kind === "note") {
    return isFileInsideFolder(file, settings.notesFolder);
  }

  return isFileInsideFolder(file, settings.activeTasksFolder)
    || isFileInsideFolder(file, settings.completedTasksFolder);
}

export function isTaskInStatusFolder(
  file: TFile,
  settings: CalendarSettings,
  done: boolean,
): boolean {
  return isFileInsideFolder(file, taskFolder(settings, done));
}

export function configuredFolderPaths(settings: CalendarSettings): string[] {
  return Array.from(new Set([
    settings.notesFolder,
    settings.activeTasksFolder,
    settings.completedTasksFolder,
  ]));
}

export function validateTaskFolders(settings: CalendarSettings): void {
  const active = normalizePath(joinPath(settings.activeTasksFolder));
  const completed = normalizePath(joinPath(settings.completedTasksFolder));
  const overlaps = active === completed
    || active === "/"
    || completed === "/"
    || active.startsWith(`${completed}/`)
    || completed.startsWith(`${active}/`);

  if (overlaps) {
    throw new Error(strings.taskFoldersConflictError);
  }
}
