import { App, Notice, TFile, normalizePath, stringifyYaml } from "obsidian";

import { getTodayDateId } from "../core/dateUtils";
import strings, { formatLocalizedString } from "../core/localization";
import type { CalendarSettings, RepeatRule } from "../core/types";
import { getNextRepeatDateId } from "../tasks/repeat";
import type { CalendarItem, CalendarItemKind } from "./calendarItem";
import { classifyFile, normalizeDateId } from "./calendarItem";
import {
  MARKDOWN_SUFFIX,
  ensureFolderOrThrow,
  makeUniquePath,
  sanitizeFileName,
} from "./fileNames";
import { joinPath } from "./folders";
import { itemFolder } from "./itemFolders";
import { buildItemName, parseItemName } from "./itemName";

export type ReconcileSource = "frontmatter" | "name";
import { buildDayIdentifier, readTemplateParts } from "./templates";

const RESERVED_FIELDS = ["calendarItem", "date", "done", "completed", "repeat"];

type TemplateResult = {
  body: string;
  fields: Record<string, unknown>;
};

const EMPTY_TEMPLATE: TemplateResult = { body: "", fields: {} };

function templatePathFor(settings: CalendarSettings, kind: CalendarItemKind): string {
  return (kind === "task" ? settings.taskTemplate : settings.noteTemplate).trim();
}

function folderErrorFor(kind: CalendarItemKind): string {
  return kind === "task" ? strings.createCalendarTaskFolderError : strings.createCalendarNoteFolderError;
}

function templateErrorFor(kind: CalendarItemKind): string {
  return kind === "task"
    ? strings.createCalendarTaskTemplateReadError
    : strings.createCalendarNoteTemplateReadError;
}

function itemNameFor(settings: CalendarSettings, kind: CalendarItemKind): string {
  const configured = kind === "task" ? settings.newTaskName : settings.newNoteName;
  const fallback = kind === "task" ? strings.newTaskDefaultTitle : strings.newNoteDefaultTitle;

  return sanitizeFileName(configured) || sanitizeFileName(fallback);
}

async function readTemplateBody(
  app: App,
  settings: CalendarSettings,
  kind: CalendarItemKind,
): Promise<TemplateResult> {
  const templatePath = templatePathFor(settings, kind);

  if (!templatePath) {
    return EMPTY_TEMPLATE;
  }

  const notifyFailure = (): TemplateResult => {
    new Notice(formatLocalizedString(templateErrorFor(kind), { path: templatePath }));

    return EMPTY_TEMPLATE;
  };

  try {
    const parts = await readTemplateParts(app, templatePath);

    if (!parts) {
      return notifyFailure();
    }

    return { body: parts.body, fields: parts.frontmatter };
  } catch (error) {
    console.warn("Failed to read calendar item template.", error);

    return notifyFailure();
  }
}

function buildFrontmatter(
  kind: CalendarItemKind,
  dateId: string,
  settings: CalendarSettings,
  templateFields: Record<string, unknown>,
): Record<string, unknown> {
  const frontmatter = Object.fromEntries(
    Object.entries(templateFields).filter(([key]) => !RESERVED_FIELDS.includes(key)),
  );

  frontmatter.calendarItem = kind;
  frontmatter.date = buildDayIdentifier(dateId, settings);

  if (kind === "task") {
    frontmatter.done = false;
  }

  return frontmatter;
}

function buildContent(frontmatter: Record<string, unknown>, body: string): string {
  const header = `---\n${stringifyYaml(frontmatter)}---\n`;
  const trimmedBody = body.trim();

  return trimmedBody ? `${header}\n${trimmedBody}\n` : header;
}

export async function createItem(
  app: App,
  settings: CalendarSettings,
  kind: CalendarItemKind,
  dateId: string,
): Promise<TFile> {
  const folderPath = joinPath(itemFolder(settings, kind));

  await ensureFolderOrThrow(app, folderPath, folderErrorFor(kind));

  const baseName = buildItemName(settings, dateId, itemNameFor(settings, kind));
  const path = makeUniquePath(app, folderPath, baseName);
  const template = await readTemplateBody(app, settings, kind);
  const frontmatter = buildFrontmatter(kind, dateId, settings, template.fields);

  return app.vault.create(path, buildContent(frontmatter, template.body));
}

export async function setItemDate(
  app: App,
  settings: CalendarSettings,
  item: CalendarItem,
  dateId: string,
): Promise<void> {
  await app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
    if (!matchesStoredDate(frontmatter, item, settings)) {
      return;
    }

    frontmatter.date = buildDayIdentifier(dateId, settings);
  });
}

function matchesStoredDate(
  frontmatter: Record<string, unknown>,
  item: CalendarItem,
  settings: CalendarSettings,
): boolean {
  return normalizeDateId(frontmatter.date, settings) === item.dateId;
}

export async function reconcileItemName(
  app: App,
  settings: CalendarSettings,
  file: TFile,
  source: ReconcileSource,
): Promise<void> {
  const active = classifyFile(app, file, settings);

  if (!active) {
    return;
  }

  const parsed = parseItemName(file.basename, settings);

  if (!parsed.dateId || parsed.dateId === active.dateId) {
    return;
  }

  if (source === "name") {
    await setItemDate(app, settings, active, parsed.dateId);

    return;
  }

  const folderPath = file.parent?.path ?? "";
  const nextName = buildItemName(settings, active.dateId, parsed.title);
  const targetPath = normalizePath(joinPath(folderPath, `${nextName}${MARKDOWN_SUFFIX}`));

  if (targetPath === file.path) {
    return;
  }

  const path = app.vault.getAbstractFileByPath(targetPath)
    ? makeUniquePath(app, folderPath, nextName)
    : targetPath;

  await app.fileManager.renameFile(file, path);
}

export async function setTaskRepeat(
  app: App,
  settings: CalendarSettings,
  item: CalendarItem,
  rule: RepeatRule | null,
): Promise<void> {
  await app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
    if (!matchesStoredDate(frontmatter, item, settings)) {
      return;
    }

    if (!rule) {
      delete frontmatter.repeat;

      return;
    }

    frontmatter.repeat = rule.frequency;
  });
}

function findReusableOccurrence(
  app: App,
  settings: CalendarSettings,
  path: string,
  dateId: string,
): TFile | null {
  const existing = app.vault.getAbstractFileByPath(path);

  if (!(existing instanceof TFile)) {
    return null;
  }

  const item = classifyFile(app, existing, settings);

  return item?.kind === "task" && item.dateId === dateId && !item.done ? existing : null;
}

async function createOccurrence(
  app: App,
  settings: CalendarSettings,
  path: string,
  dateId: string,
  rule: RepeatRule,
): Promise<void> {
  const template = await readTemplateBody(app, settings, "task");
  const frontmatter = buildFrontmatter("task", dateId, settings, template.fields);

  frontmatter.repeat = rule.frequency;

  await app.vault.create(path, buildContent(frontmatter, template.body));
}

export async function completeRepeatingOccurrence(
  app: App,
  settings: CalendarSettings,
  item: CalendarItem,
): Promise<void> {
  const rule = item.repeat;

  if (!rule) {
    return;
  }

  const occurrenceDateId = item.dateId;
  const storedDateId = normalizeDateId(
    app.metadataCache.getFileCache(item.file)?.frontmatter?.date,
    settings,
  );

  if (storedDateId !== occurrenceDateId) {
    return;
  }

  const nextDateId = getNextRepeatDateId(occurrenceDateId, rule, getTodayDateId());
  const title = parseItemName(item.file.basename, settings).title;
  const folderPath = joinPath(settings.activeTasksFolder);
  await ensureFolderOrThrow(app, folderPath, strings.createCalendarTaskFolderError);
  const nextName = buildItemName(settings, nextDateId, title);
  const targetPath = normalizePath(joinPath(folderPath, `${nextName}${MARKDOWN_SUFFIX}`));

  const reusableOccurrence = findReusableOccurrence(app, settings, targetPath, nextDateId);

  if (app.vault.getAbstractFileByPath(targetPath) && !reusableOccurrence) {
    new Notice(
      formatLocalizedString(strings.repeatOccurrenceConflictError, { path: targetPath }),
    );

    return;
  }

  if (reusableOccurrence) {
    await app.fileManager.processFrontMatter(
      reusableOccurrence,
      (frontmatter: Record<string, unknown>) => {
        frontmatter.repeat = rule.frequency;
      },
    );
  } else {
    await createOccurrence(app, settings, targetPath, nextDateId, rule);
  }

  await app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
    delete frontmatter.repeat;
  });
}
