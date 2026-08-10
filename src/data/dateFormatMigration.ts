import { App, TFile, normalizePath } from "obsidian";

import type { CalendarSettings } from "../core/types";
import { classifyItemFile, normalizeDateId } from "./item";
import { MARKDOWN_SUFFIX } from "./fileNames";
import { joinPath } from "./folders";
import { buildItemName, parseItemName } from "./itemName";
import { buildDayIdentifier } from "./templates";

export type DateFormatMigrationEntry = {
  file: TFile;
  originalPath: string;
  originalDateSignature: string;
  originalCompletedSignature: string;
  date: string | null;
  completed: string | null;
  targetPath: string | null;
};

export type DateFormatMigrationSample = {
  from: string;
  to: string;
};

export type DateFormatMigrationPlan = {
  entries: DateFormatMigrationEntry[];
  renameCount: number;
  sample: DateFormatMigrationSample | null;
};

export type DateFormatMigrationResult = {
  migrated: number;
  renamed: number;
  failures: string[];
};

function valueSignature(value: unknown): string {
  if (value instanceof Date) {
    return `date:${value.toISOString()}`;
  }

  return JSON.stringify(value) ?? "undefined";
}

function resolveTargetPath(
  file: TFile,
  dateId: string,
  settings: CalendarSettings,
  nextSettings: CalendarSettings,
): string | null {
  const parsed = parseItemName(file.basename, settings);
  const nextName = buildItemName(nextSettings, dateId, parsed.title);
  const folderPath = file.parent?.path ?? "";
  const targetPath = normalizePath(joinPath(folderPath, `${nextName}${MARKDOWN_SUFFIX}`));

  return targetPath === file.path ? null : targetPath;
}

function buildEntry(
  file: TFile,
  dateId: string | undefined,
  frontmatter: Record<string, unknown>,
  settings: CalendarSettings,
  nextSettings: CalendarSettings,
  renameFile: boolean,
): DateFormatMigrationEntry | null {
  const date = dateId ? buildDayIdentifier(dateId, nextSettings) : null;
  const completedId = normalizeDateId(frontmatter.completed, settings);
  const completed = completedId ? buildDayIdentifier(completedId, nextSettings) : null;
  const targetPath = renameFile && dateId
    ? resolveTargetPath(file, dateId, settings, nextSettings)
    : null;

  const dateChanged = Boolean(date) && frontmatter.date !== date;
  const completedChanged = Boolean(completed) && frontmatter.completed !== completed;

  if (!dateChanged && !completedChanged && !targetPath) {
    return null;
  }

  return {
    file,
    originalPath: file.path,
    originalDateSignature: valueSignature(frontmatter.date),
    originalCompletedSignature: valueSignature(frontmatter.completed),
    date,
    completed,
    targetPath,
  };
}

export function planDateFormatMigration(
  app: App,
  settings: CalendarSettings,
  nextFormat: string,
): DateFormatMigrationPlan {
  const nextSettings: CalendarSettings = { ...settings, dateFormat: nextFormat };
  const entries: DateFormatMigrationEntry[] = [];
  let renameCount = 0;
  let sample: DateFormatMigrationSample | null = null;

  for (const file of app.vault.getMarkdownFiles()) {
    const currentItem = classifyItemFile(app, file, settings);

    if (!currentItem) {
      continue;
    }

    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

    if (!frontmatter) {
      continue;
    }

    const parsedName = parseItemName(file.basename, settings);
    const hasSynchronizedDatePrefix = Boolean(
      currentItem.dateId && parsedName.dateId === currentItem.dateId,
    );

    const entry = buildEntry(
      file,
      currentItem.dateId,
      frontmatter,
      settings,
      nextSettings,
      currentItem.kind === "note" || hasSynchronizedDatePrefix,
    );

    if (!entry) {
      continue;
    }

    entries.push(entry);

    if (entry.targetPath) {
      renameCount += 1;
    }

    if (!sample && entry.date && typeof frontmatter.date === "string") {
      sample = { from: frontmatter.date, to: entry.date };
    }
  }

  return { entries, renameCount, sample };
}

async function applyEntry(app: App, entry: DateFormatMigrationEntry): Promise<boolean> {
  if (entry.file.path !== entry.originalPath) {
    throw new Error(`Calendar item moved during date migration: ${entry.originalPath}`);
  }

  if (entry.targetPath && app.vault.getAbstractFileByPath(entry.targetPath)) {
    throw new Error(`Date migration target already exists: ${entry.targetPath}`);
  }

  const updateFrontmatter = async (): Promise<void> => {
    await app.fileManager.processFrontMatter(
      entry.file,
      (frontmatter: Record<string, unknown>) => {
        if (
          valueSignature(frontmatter.date) !== entry.originalDateSignature
          || valueSignature(frontmatter.completed) !== entry.originalCompletedSignature
        ) {
          throw new Error(`Calendar item changed during date migration: ${entry.originalPath}`);
        }

        if (entry.date) {
          frontmatter.date = entry.date;
        }

        if (entry.completed) {
          frontmatter.completed = entry.completed;
        }
      },
    );
  };

  if (!entry.targetPath) {
    await updateFrontmatter();

    return false;
  }

  await app.fileManager.renameFile(entry.file, entry.targetPath);

  try {
    await updateFrontmatter();
  } catch (error) {
    try {
      await app.fileManager.renameFile(entry.file, entry.originalPath);
    } catch (rollbackError) {
      console.error("Failed to roll back calendar item rename after migration error.", rollbackError);
    }

    throw error;
  }

  return true;
}

export async function applyDateFormatMigration(
  app: App,
  plan: DateFormatMigrationPlan,
): Promise<DateFormatMigrationResult> {
  const failures: string[] = [];
  let migrated = 0;
  let renamed = 0;

  for (const entry of plan.entries) {
    try {
      const wasRenamed = await applyEntry(app, entry);

      migrated += 1;

      if (wasRenamed) {
        renamed += 1;
      }
    } catch (error) {
      console.error("Failed to migrate calendar item to the new date format.", error);
      failures.push(entry.file.path);
    }
  }

  return { migrated, renamed, failures };
}
