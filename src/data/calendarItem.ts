import { App, TFile, normalizePath } from "obsidian";

import { MARKDOWN_EXTENSION } from "../core/constants";
import { formatDateId, momentFormatToPattern, parseDateByPattern } from "../core/dateUtils";
import type { CalendarSettings, RepeatFrequency, RepeatRule } from "../core/types";
import { joinPath } from "./folders";
import { parseItemName } from "./itemName";

const ITEM_MARKER_FIELD = "calendarItem";
const DATE_ID_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ITEM_KINDS: readonly CalendarItemKind[] = ["note", "task"];
const REPEAT_FREQUENCIES: readonly RepeatFrequency[] = ["daily", "weekly", "monthly", "yearly"];

export type CalendarItemKind = "note" | "task";

export type CalendarItem = {
  file: TFile;
  title: string;
  dateId: string;
  kind: CalendarItemKind;
  done: boolean;
  completed?: string;
  repeat?: RepeatRule;
};

function isInsideFolder(file: TFile, configuredPath: string): boolean {
  const folder = normalizePath(joinPath(configuredPath));

  if (!folder || folder === "/") {
    return true;
  }

  return file.path.startsWith(`${folder}/`);
}

export function isTaskInStatusFolder(
  file: TFile,
  settings: CalendarSettings,
  done: boolean,
): boolean {
  return isInsideFolder(file, done ? settings.completedTasksFolder : settings.activeTasksFolder);
}

function isInItemScope(file: TFile, settings: CalendarSettings, kind: CalendarItemKind): boolean {
  if (kind === "note") {
    return isInsideFolder(file, settings.notesFolder);
  }

  return isInsideFolder(file, settings.activeTasksFolder)
    || isInsideFolder(file, settings.completedTasksFolder);
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month, day);

  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
}

function parseIsoDateId(value: string): string | null {
  const match = DATE_ID_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  return isRealDate(year, month, day) ? formatDateId(year, month, day) : null;
}

export function normalizeDateId(value: unknown, settings: CalendarSettings): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return formatDateId(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = parseDateByPattern(trimmed, momentFormatToPattern(settings.dateFormat));

  if (parsed) {
    return formatDateId(parsed.year, parsed.month, parsed.day);
  }

  return parseIsoDateId(trimmed);
}

function normalizeDone(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

function normalizeRepeatRule(frontmatter: Record<string, unknown>): RepeatRule | null {
  const rawFrequency = frontmatter.repeat;

  if (typeof rawFrequency !== "string") {
    return null;
  }

  const frequency = rawFrequency.trim().toLowerCase() as RepeatFrequency;

  if (!REPEAT_FREQUENCIES.includes(frequency)) {
    return null;
  }

  return { frequency };
}

function normalizeKind(value: unknown): CalendarItemKind | null {
  if (typeof value !== "string") {
    return null;
  }

  const kind = value.trim().toLowerCase() as CalendarItemKind;

  return ITEM_KINDS.includes(kind) ? kind : null;
}

export function classifyFile(
  app: App,
  file: TFile,
  settings: CalendarSettings,
): CalendarItem | null {
  if (file.extension !== MARKDOWN_EXTENSION) {
    return null;
  }

  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

  if (!frontmatter) {
    return null;
  }

  const kind = normalizeKind(frontmatter[ITEM_MARKER_FIELD]);

  if (!kind) {
    return null;
  }

  if (!isInItemScope(file, settings, kind)) {
    return null;
  }

  const dateId = normalizeDateId(frontmatter.date, settings);

  if (!dateId) {
    return null;
  }

  const title = parseItemName(file.basename, settings).title;
  const done = kind === "task" && normalizeDone(frontmatter.done);
  const completed = done ? normalizeDateId(frontmatter.completed, settings) : null;
  const repeat = kind === "task" ? normalizeRepeatRule(frontmatter) : null;

  return {
    file,
    title,
    dateId,
    kind,
    done,
    ...(completed ? { completed } : {}),
    ...(repeat ? { repeat } : {}),
  };
}
