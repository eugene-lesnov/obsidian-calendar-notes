import { TFile, normalizePath } from "obsidian";

import strings, { formatLocalizedString } from "../core/localization";
import type { VaultAgendaSettings, TaskList, TaskLocation } from "../core/types";
import { joinPath } from "./folders";

export type TaskScopeMatch = {
  taskList: TaskList;
  location: TaskLocation;
  relativePath: string;
};

export function normalizeFolderPath(path: string): string {
  return normalizePath(joinPath(path));
}

function pathInsideScope(path: string, scopePath: string): boolean {
  const normalizedPath = normalizePath(path);

  if (!scopePath || scopePath === "/") {
    return true;
  }

  return normalizedPath.startsWith(`${scopePath}/`);
}

export function isFileInsideFolder(file: TFile, configuredPath: string): boolean {
  return pathInsideScope(file.path, normalizeFolderPath(configuredPath));
}

function relativePath(path: string, scopePath: string): string {
  return scopePath && scopePath !== "/" ? path.slice(scopePath.length + 1) : path;
}

export function findTaskScope(
  file: TFile,
  settings: VaultAgendaSettings,
): TaskScopeMatch | null {
  for (const taskList of settings.taskLists) {
    const activePath = normalizeFolderPath(taskList.activeFolder);

    if (pathInsideScope(file.path, activePath)) {
      return {
        taskList,
        location: "active",
        relativePath: relativePath(file.path, activePath),
      };
    }

    if (taskList.completionBehavior.type !== "move") {
      continue;
    }

    const completedPath = normalizeFolderPath(taskList.completionBehavior.completedFolder);

    if (pathInsideScope(file.path, completedPath)) {
      return {
        taskList,
        location: "completed",
        relativePath: relativePath(file.path, completedPath),
      };
    }
  }

  return null;
}

export function getTaskList(settings: VaultAgendaSettings, id: string): TaskList | null {
  return settings.taskLists.find((list) => list.id === id) ?? null;
}

export function configuredScopeFolders(settings: VaultAgendaSettings): string[] {
  const paths = [settings.notesFolder];

  settings.taskLists.forEach((taskList) => {
    paths.push(taskList.activeFolder);

    if (taskList.completionBehavior.type === "move") {
      paths.push(taskList.completionBehavior.completedFolder);
    }
  });

  const normalizedPaths = Array.from(new Set(paths.map(normalizeFolderPath).filter(Boolean)));

  if (normalizedPaths.includes("/")) {
    return ["/"];
  }

  return normalizedPaths.filter((path, index) => !normalizedPaths.some((candidate, candidateIndex) =>
    candidateIndex !== index && path.startsWith(`${candidate}/`),
  ));
}

function scopesOverlap(first: string, second: string): boolean {
  if (first === "/" || second === "/") {
    return true;
  }

  return first === second
    || Boolean(first && second.startsWith(`${first}/`))
    || Boolean(second && first.startsWith(`${second}/`));
}

export function validateTaskLists(settings: VaultAgendaSettings): void {
  const ids = new Set<string>();
  const scopes: string[] = [];

  for (const taskList of settings.taskLists) {
    if (!taskList.id.trim() || ids.has(taskList.id)) {
      throw new Error(strings.taskListIdError);
    }

    if (!taskList.name.trim()) {
      throw new Error(strings.taskListNameRequiredError);
    }

    ids.add(taskList.id);

    const activePath = normalizeFolderPath(taskList.activeFolder);

    if (!taskList.activeFolder.trim() || !activePath) {
      throw new Error(formatLocalizedString(strings.taskListFolderRequiredError, {
        name: taskList.name,
      }));
    }

    scopes.push(activePath);

    if (taskList.completionBehavior.type === "move") {
      const completedPath = normalizeFolderPath(taskList.completionBehavior.completedFolder);

      if (
        !taskList.completionBehavior.completedFolder.trim()
        || !completedPath
        || activePath === "/"
        || completedPath === "/"
      ) {
        throw new Error(formatLocalizedString(strings.taskListFolderRequiredError, {
          name: taskList.name,
        }));
      }

      scopes.push(completedPath);
    }
  }

  for (let firstIndex = 0; firstIndex < scopes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < scopes.length; secondIndex += 1) {
      const first = scopes[firstIndex];
      const second = scopes[secondIndex];

      if (scopesOverlap(first, second)) {
        throw new Error(strings.taskListFoldersConflictError);
      }
    }
  }
}
