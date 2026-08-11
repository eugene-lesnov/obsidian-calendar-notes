import { App, TFile, normalizePath } from "obsidian";

import { getTodayDateId } from "../core/dateUtils";
import strings from "../core/localization";
import type { VaultAgendaSettings, TaskList } from "../core/types";
import type { Task } from "./item";
import { normalizeDateId } from "./item";
import { MARKDOWN_SUFFIX, ensureFolderOrThrow, makeUniquePath } from "./fileNames";
import { joinPath } from "./folders";
import { findTaskScope, getTaskList } from "./itemScopes";
import { buildDayIdentifier } from "./templates";

const transitions = new WeakSet<TFile>();

export function isTaskCompletionTransitioning(file: TFile): boolean {
  return transitions.has(file);
}

function resolveCompletionFolder(taskList: TaskList, completed: boolean): string {
  if (!completed || taskList.completionBehavior.type === "keep") {
    return taskList.activeFolder;
  }

  return taskList.completionBehavior.completedFolder;
}

async function moveTaskForCompletion(
  app: App,
  taskList: TaskList,
  file: TFile,
  relativePath: string,
  completed: boolean,
): Promise<string | null> {
  if (taskList.completionBehavior.type === "keep") {
    return null;
  }

  const folderPath = joinPath(resolveCompletionFolder(taskList, completed));
  const directTargetPath = normalizePath(joinPath(folderPath, relativePath));

  if (directTargetPath === file.path) {
    return null;
  }

  const separatorIndex = directTargetPath.lastIndexOf("/");
  const targetFolder = separatorIndex >= 0 ? directTargetPath.slice(0, separatorIndex) : "";
  const targetName = separatorIndex >= 0
    ? directTargetPath.slice(separatorIndex + 1)
    : directTargetPath;
  const baseName = targetName.endsWith(MARKDOWN_SUFFIX)
    ? targetName.slice(0, -MARKDOWN_SUFFIX.length)
    : targetName;
  const targetPath = app.vault.getAbstractFileByPath(directTargetPath)
    ? makeUniquePath(app, targetFolder, baseName)
    : directTargetPath;

  await ensureFolderOrThrow(app, targetFolder, strings.createAgendaTaskFolderError);
  const originalPath = file.path;
  await app.fileManager.renameFile(file, targetPath);

  return originalPath;
}

async function rollbackMove(
  app: App,
  file: TFile,
  originalPath: string | null,
): Promise<boolean> {
  if (!originalPath || file.path === originalPath) {
    return false;
  }

  try {
    await app.fileManager.renameFile(file, originalPath);
    return false;
  } catch (error) {
    console.error("Failed to roll back task move.", error);
    return true;
  }
}

export async function setTaskCompleted(
  app: App,
  settings: VaultAgendaSettings,
  item: Task,
  completed: boolean,
  options: { stopRepeat?: boolean } = {},
): Promise<void> {
  if (item.done === completed) {
    return;
  }

  const match = findTaskScope(item.file, settings);
  const taskList = getTaskList(settings, item.taskListId);

  if (!match || !taskList || match.taskList.id !== taskList.id) {
    throw new Error(strings.taskListRequiredError);
  }

  const storedFrontmatter = app.metadataCache.getFileCache(item.file)?.frontmatter;

  if (storedFrontmatter?.done !== item.done) {
    throw new Error(`Task changed before its completion could be updated: ${item.file.path}`);
  }

  transitions.add(item.file);
  let originalPath: string | null = null;

  try {
    originalPath = await moveTaskForCompletion(
      app,
      taskList,
      item.file,
      match.relativePath,
      completed,
    );
    await app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
      if (frontmatter.done !== item.done) {
        throw new Error(`Task changed before its completion could be updated: ${item.file.path}`);
      }

      frontmatter.done = completed;

      if (completed) {
        frontmatter.completed = buildDayIdentifier(getTodayDateId(), settings);
      } else {
        delete frontmatter.completed;
      }

      if (options.stopRepeat) {
        delete frontmatter.repeat;
      }
    });
  } catch (error) {
    const rollbackError = await rollbackMove(app, item.file, originalPath);

    if (rollbackError) {
      throw new Error(
        `Task update failed and its move could not be rolled back. Current path: ${item.file.path}`,
      );
    }

    throw error;
  } finally {
    transitions.delete(item.file);
  }
}

export async function applyExternalTaskCompletion(
  app: App,
  settings: VaultAgendaSettings,
  previous: Task,
  current: Task,
): Promise<void> {
  if (previous.done === current.done || isTaskCompletionTransitioning(current.file)) {
    return;
  }

  const match = findTaskScope(current.file, settings);
  const taskList = getTaskList(settings, current.taskListId);

  if (!match || !taskList) {
    return;
  }

  transitions.add(current.file);
  const originalCompleted: unknown = app.metadataCache
    .getFileCache(current.file)?.frontmatter?.completed;

  try {
    await app.fileManager.processFrontMatter(current.file, (frontmatter: Record<string, unknown>) => {
      if (frontmatter.done !== current.done) {
        throw new Error(`Task changed during completion synchronization: ${current.file.path}`);
      }

      if (current.done) {
        if (!normalizeDateId(frontmatter.completed, settings)) {
          frontmatter.completed = buildDayIdentifier(getTodayDateId(), settings);
        }
      } else {
        delete frontmatter.completed;
      }
    });

    try {
      await moveTaskForCompletion(app, taskList, current.file, match.relativePath, current.done);
    } catch (error) {
      await app.fileManager.processFrontMatter(
        current.file,
        (frontmatter: Record<string, unknown>) => {
          if (frontmatter.done !== current.done) {
            throw new Error(`Task changed during completion rollback: ${current.file.path}`);
          }

          if (originalCompleted === undefined) {
            delete frontmatter.completed;
          } else {
            frontmatter.completed = originalCompleted;
          }
        },
      );
      throw error;
    }
  } finally {
    transitions.delete(current.file);
  }
}
