import { App, Notice, TFile, normalizePath, stringifyYaml } from "obsidian";

import { getTodayDateId } from "../core/dateUtils";
import strings, { formatLocalizedString } from "../core/localization";
import type {
  CalendarSettings,
  RepeatRule,
  TaskList,
} from "../core/types";
import { getNextRepeatDateId } from "../tasks/repeat";
import type { Item, ItemKind, Task } from "./item";
import { classifyItemFile, normalizeDateId } from "./item";
import {
  MARKDOWN_SUFFIX,
  ensureFolderOrThrow,
  makeUniquePath,
  sanitizeFileName,
} from "./fileNames";
import { joinPath } from "./folders";
import { getTaskList } from "./itemScopes";
import { buildItemName, parseItemName } from "./itemName";
import { buildDayIdentifier, readTemplateParts } from "./templates";

export type ReconcileTrigger = "frontmatter" | "name";

const RESERVED_FIELDS = ["calendarItem", "date", "done", "completed", "repeat"];

type TemplateResult = {
  body: string;
  fields: Record<string, unknown>;
};

const EMPTY_TEMPLATE: TemplateResult = { body: "", fields: {} };

function folderErrorFor(kind: ItemKind): string {
  return kind === "task"
    ? strings.createCalendarTaskFolderError
    : strings.createCalendarNoteFolderError;
}

function templateErrorFor(kind: ItemKind): string {
  return kind === "task"
    ? strings.createCalendarTaskTemplateReadError
    : strings.createCalendarNoteTemplateReadError;
}

function noteNameFor(settings: CalendarSettings): string {
  return sanitizeFileName(settings.newNoteName) || sanitizeFileName(strings.newNoteDefaultTitle);
}

function taskNameFor(taskList: TaskList): string {
  return sanitizeFileName(taskList.newTaskName) || sanitizeFileName(strings.newTaskDefaultTitle);
}

async function readTemplateBody(
  app: App,
  kind: ItemKind,
  configuredPath: string,
): Promise<TemplateResult> {
  const templatePath = configuredPath.trim();

  if (!templatePath) {
    return EMPTY_TEMPLATE;
  }

  const notifyFailure = (): TemplateResult => {
    new Notice(formatLocalizedString(templateErrorFor(kind), { path: templatePath }));

    return EMPTY_TEMPLATE;
  };

  try {
    const parts = await readTemplateParts(app, templatePath);

    return parts ? { body: parts.body, fields: parts.frontmatter } : notifyFailure();
  } catch (error) {
    console.warn("Failed to read calendar item template.", error);

    return notifyFailure();
  }
}

function buildFrontmatter(
  kind: ItemKind,
  settings: CalendarSettings,
  templateFields: Record<string, unknown>,
  dateId?: string,
): Record<string, unknown> {
  const frontmatter = Object.fromEntries(
    Object.entries(templateFields).filter(([key]) => !RESERVED_FIELDS.includes(key)),
  );

  frontmatter.calendarItem = kind;

  if (dateId) {
    frontmatter.date = buildDayIdentifier(dateId, settings);
  }

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

export async function createNote(
  app: App,
  settings: CalendarSettings,
  dateId: string,
): Promise<TFile> {
  const folderPath = joinPath(settings.notesFolder);
  await ensureFolderOrThrow(app, folderPath, folderErrorFor("note"));
  const name = buildItemName(settings, dateId, noteNameFor(settings));
  const path = makeUniquePath(app, folderPath, name);
  const template = await readTemplateBody(app, "note", settings.noteTemplate);
  const frontmatter = buildFrontmatter("note", settings, template.fields, dateId);

  return app.vault.create(path, buildContent(frontmatter, template.body));
}

export async function createTask(
  app: App,
  settings: CalendarSettings,
  taskList: TaskList,
  dateId?: string,
): Promise<TFile> {
  const folderPath = joinPath(taskList.activeFolder);
  await ensureFolderOrThrow(app, folderPath, folderErrorFor("task"));
  const path = makeUniquePath(app, folderPath, taskNameFor(taskList));
  const template = await readTemplateBody(app, "task", taskList.taskTemplate);
  const frontmatter = buildFrontmatter("task", settings, template.fields, dateId);

  return app.vault.create(path, buildContent(frontmatter, template.body));
}

export async function createDatedItem(
  app: App,
  settings: CalendarSettings,
  kind: ItemKind,
  dateId: string,
): Promise<TFile> {
  if (kind === "note") {
    return createNote(app, settings, dateId);
  }

  const taskList = settings.taskLists[0];

  if (!taskList) {
    throw new Error(strings.taskListRequiredError);
  }

  return createTask(app, settings, taskList, dateId);
}

export async function setItemDate(
  app: App,
  settings: CalendarSettings,
  item: Item,
  dateId: string,
): Promise<void> {
  await app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
    const storedDateId = normalizeDateId(frontmatter.date, settings);

    if (item.dateId ? storedDateId !== item.dateId : storedDateId !== null) {
      throw new Error(`Item changed before its date could be updated: ${item.file.path}`);
    }

    frontmatter.date = buildDayIdentifier(dateId, settings);
  });
}

export async function unscheduleTask(
  app: App,
  settings: CalendarSettings,
  item: Task,
): Promise<void> {
  await app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
    if (normalizeDateId(frontmatter.date, settings) !== item.dateId) {
      throw new Error(`Task changed before it could be unscheduled: ${item.file.path}`);
    }

    delete frontmatter.date;
    delete frontmatter.repeat;
  });
}

export async function reconcileItemName(
  app: App,
  settings: CalendarSettings,
  file: TFile,
  trigger: ReconcileTrigger,
): Promise<void> {
  const currentItem = classifyItemFile(app, file, settings);

  if (!currentItem || currentItem.kind !== "note") {
    return;
  }

  const parsed = parseItemName(file.basename, settings);

  if (!parsed.dateId || parsed.dateId === currentItem.dateId) {
    return;
  }

  if (trigger === "name") {
    await setItemDate(app, settings, currentItem, parsed.dateId);

    return;
  }

  const folderPath = file.parent?.path ?? "";
  const nextName = buildItemName(settings, currentItem.dateId, parsed.title);
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
  item: Task,
  rule: RepeatRule | null,
): Promise<void> {
  if (rule && !item.dateId) {
    throw new Error(strings.repeatRequiresDateError);
  }

  await app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
    if (normalizeDateId(frontmatter.date, settings) !== (item.dateId ?? null)) {
      throw new Error(`Task changed before its repeat rule could be updated: ${item.file.path}`);
    }

    if (rule) {
      frontmatter.repeat = rule.frequency;
    } else {
      delete frontmatter.repeat;
    }
  });
}

async function createOccurrence(
  app: App,
  settings: CalendarSettings,
  taskList: TaskList,
  path: string,
  dateId: string,
  rule: RepeatRule,
): Promise<void> {
  const template = await readTemplateBody(app, "task", taskList.taskTemplate);
  const frontmatter = buildFrontmatter("task", settings, template.fields, dateId);
  frontmatter.repeat = rule.frequency;
  await app.vault.create(path, buildContent(frontmatter, template.body));
}

export async function completeRepeatingOccurrence(
  app: App,
  settings: CalendarSettings,
  item: Task,
): Promise<void> {
  if (!item.repeat || !item.dateId) {
    return;
  }

  const storedDateId = normalizeDateId(
    app.metadataCache.getFileCache(item.file)?.frontmatter?.date,
    settings,
  );

  if (storedDateId !== item.dateId) {
    return;
  }

  const taskList = getTaskList(settings, item.taskListId);

  if (!taskList) {
    throw new Error(strings.taskListRequiredError);
  }

  const nextDateId = getNextRepeatDateId(item.dateId, item.repeat, getTodayDateId());
  const folderPath = joinPath(taskList.activeFolder);
  await ensureFolderOrThrow(app, folderPath, strings.createCalendarTaskFolderError);
  const title = parseItemName(item.file.basename, settings).title;
  const nextName = buildItemName(settings, nextDateId, title);
  const targetPath = normalizePath(joinPath(folderPath, `${nextName}${MARKDOWN_SUFFIX}`));

  if (app.vault.getAbstractFileByPath(targetPath)) {
    throw new Error(formatLocalizedString(strings.repeatOccurrenceConflictError, {
      path: targetPath,
    }));
  }

  await createOccurrence(app, settings, taskList, targetPath, nextDateId, item.repeat);
  await app.fileManager.processFrontMatter(item.file, (frontmatter: Record<string, unknown>) => {
    delete frontmatter.repeat;
  });
}
