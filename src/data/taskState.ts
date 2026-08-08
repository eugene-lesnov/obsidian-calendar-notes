import { App, TFile, normalizePath } from "obsidian";

import { getTodayDateId } from "../core/dateUtils";
import strings from "../core/localization";
import type { CalendarSettings } from "../core/types";
import type { CalendarItem } from "./calendarItem";
import { normalizeDateId } from "./calendarItem";
import { ensureFolderOrThrow, makeUniquePath } from "./fileNames";
import { joinPath } from "./folders";
import { isTaskInStatusFolder, taskFolder } from "./itemFolders";
import { buildDayIdentifier } from "./templates";

const transitions = new WeakSet<TFile>();

export function isTaskStateTransitioning(file: TFile): boolean {
  return transitions.has(file);
}

async function moveToStatusFolder(
  app: App,
  settings: CalendarSettings,
  file: TFile,
  done: boolean,
): Promise<string> {
  const sourcePath = file.path;
  const folderPath = joinPath(taskFolder(settings, done));

  await ensureFolderOrThrow(app, folderPath, strings.createCalendarTaskFolderError);

  if (isTaskInStatusFolder(file, settings, done)) {
    return sourcePath;
  }

  const directPath = normalizePath(joinPath(folderPath, file.name));
  const targetPath = app.vault.getAbstractFileByPath(directPath)
    ? makeUniquePath(app, folderPath, file.basename)
    : directPath;

  await app.fileManager.renameFile(file, targetPath);

  return sourcePath;
}

async function rollbackMove(app: App, file: TFile, sourcePath: string): Promise<void> {
  if (file.path === sourcePath) {
    return;
  }

  try {
    await app.fileManager.renameFile(file, sourcePath);
  } catch (error) {
    console.error("Failed to roll back task move.", error);
  }
}

export async function synchronizeTaskState(
  app: App,
  settings: CalendarSettings,
  item: CalendarItem,
): Promise<void> {
  const frontmatter = app.metadataCache.getFileCache(item.file)?.frontmatter;
  const hasCompletedDate = Boolean(normalizeDateId(frontmatter?.completed, settings));
  const hasRawCompleted = frontmatter?.completed !== undefined;

  if ((item.done && !hasCompletedDate) || (!item.done && hasRawCompleted)) {
    await app.fileManager.processFrontMatter(item.file, (current: Record<string, unknown>) => {
      if (item.done) {
        if (!normalizeDateId(current.completed, settings)) {
          current.completed = buildDayIdentifier(getTodayDateId(), settings);
        }
      } else {
        delete current.completed;
      }
    });
  }

  await moveToStatusFolder(app, settings, item.file, item.done);
}

export async function setTaskDone(
  app: App,
  settings: CalendarSettings,
  item: CalendarItem,
  done: boolean,
  options: { stopRepeat?: boolean } = {},
): Promise<void> {
  if (options.stopRepeat) {
    const storedDateId = normalizeDateId(
      app.metadataCache.getFileCache(item.file)?.frontmatter?.date,
      settings,
    );

    if (storedDateId !== item.dateId) {
      throw new Error(`Task changed before it could be completed: ${item.file.path}`);
    }
  }

  transitions.add(item.file);
  let sourcePath = item.file.path;

  try {
    sourcePath = await moveToStatusFolder(app, settings, item.file, done);
    await app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
      if (options.stopRepeat && normalizeDateId(frontmatter.date, settings) !== item.dateId) {
        throw new Error(`Task changed before it could be completed: ${item.file.path}`);
      }

      frontmatter.done = done;

      if (done) {
        frontmatter.completed = buildDayIdentifier(getTodayDateId(), settings);
      } else {
        delete frontmatter.completed;
      }

      if (options.stopRepeat) {
        delete frontmatter.repeat;
      }
    });
  } catch (error) {
    await rollbackMove(app, item.file, sourcePath);
    throw error;
  } finally {
    transitions.delete(item.file);
  }
}
