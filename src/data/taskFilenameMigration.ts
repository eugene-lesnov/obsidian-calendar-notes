import { App, TFile, normalizePath } from "obsidian";

import type { VaultAgendaSettings } from "../core/types";
import { classifyItemFile } from "./item";
import { MARKDOWN_SUFFIX, makeUniquePath } from "./fileNames";
import { joinPath } from "./folders";
import { buildItemNameFromExistingTitle, parseItemName } from "./itemName";

export type TaskFilenameMigrationEntry = {
  file: TFile;
  originalPath: string;
  targetName: string;
};

export type TaskFilenameMigrationPlan = {
  entries: TaskFilenameMigrationEntry[];
};

export type TaskFilenameMigrationResult = {
  renamed: number;
  failures: string[];
};

function resolveTargetName(
  file: TFile,
  dateId: string | undefined,
  settings: VaultAgendaSettings,
  enabled: boolean,
): string | null {
  const parsed = parseItemName(file.basename, settings);

  if (enabled) {
    if (!dateId) {
      return null;
    }

    return buildItemNameFromExistingTitle(
      settings,
      dateId,
      parsed.dateId === dateId ? parsed.title : file.basename,
    );
  }

  if (!dateId || parsed.dateId !== dateId) {
    return null;
  }

  return parsed.title;
}

export function planTaskFilenameMigration(
  app: App,
  settings: VaultAgendaSettings,
  enabled: boolean,
): TaskFilenameMigrationPlan {
  const entries: TaskFilenameMigrationEntry[] = [];

  for (const file of app.vault.getMarkdownFiles()) {
    const item = classifyItemFile(app, file, settings);

    if (item?.kind !== "task") {
      continue;
    }

    const targetName = resolveTargetName(file, item.dateId, settings, enabled);

    if (!targetName || targetName === file.basename) {
      continue;
    }

    entries.push({ file, originalPath: file.path, targetName });
  }

  return { entries };
}

export async function applyTaskFilenameMigration(
  app: App,
  settings: VaultAgendaSettings,
  enabled: boolean,
  plan: TaskFilenameMigrationPlan,
): Promise<TaskFilenameMigrationResult> {
  const applied: TaskFilenameMigrationEntry[] = [];

  for (const entry of plan.entries) {
    try {
      if (entry.file.path !== entry.originalPath) {
        throw new Error(`Task moved during filename migration: ${entry.originalPath}`);
      }

      const item = classifyItemFile(app, entry.file, settings);
      const currentTargetName = item?.kind === "task"
        ? resolveTargetName(entry.file, item.dateId, settings, enabled)
        : null;

      if (currentTargetName !== entry.targetName) {
        throw new Error(`Task changed during filename migration: ${entry.originalPath}`);
      }

      const folderPath = entry.file.parent?.path ?? "";
      const directTargetPath = normalizePath(
        joinPath(folderPath, `${entry.targetName}${MARKDOWN_SUFFIX}`),
      );
      const targetPath = app.vault.getAbstractFileByPath(directTargetPath)
        ? makeUniquePath(app, folderPath, entry.targetName)
        : directTargetPath;

      await app.fileManager.renameFile(entry.file, targetPath);
      applied.push(entry);
    } catch (error) {
      console.error("Failed to migrate a Vault Agenda task filename.", error);
      const rollbackFailures = await rollbackTaskFilenameMigration(app, { entries: applied });

      return {
        renamed: 0,
        failures: Array.from(new Set([entry.originalPath, ...rollbackFailures])),
      };
    }
  }

  return { renamed: applied.length, failures: [] };
}

export async function rollbackTaskFilenameMigration(
  app: App,
  plan: TaskFilenameMigrationPlan,
): Promise<string[]> {
  const failures: string[] = [];

  for (const entry of [...plan.entries].reverse()) {
    if (entry.file.path === entry.originalPath) {
      continue;
    }

    try {
      if (app.vault.getAbstractFileByPath(entry.originalPath)) {
        throw new Error(`Task filename rollback target already exists: ${entry.originalPath}`);
      }

      await app.fileManager.renameFile(entry.file, entry.originalPath);
    } catch (error) {
      console.error("Failed to roll back a Vault Agenda task filename migration.", error);
      failures.push(entry.file.path);
    }
  }

  return failures;
}
