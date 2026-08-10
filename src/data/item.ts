import { App, TFile } from "obsidian";

import { MARKDOWN_EXTENSION } from "../core/constants";
import { formatDateId, momentFormatToPattern, parseDateByPattern } from "../core/dateUtils";
import type {
  VaultAgendaSettings,
  RepeatFrequency,
  RepeatRule,
  TaskLocation,
} from "../core/types";
import { findTaskScope, isFileInsideFolder } from "./itemScopes";
import { parseItemName } from "./itemName";

const ITEM_MARKER_FIELD = "vaultAgendaItem";
const DATE_ID_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ITEM_KINDS: readonly ItemKind[] = ["note", "task"];
const REPEAT_FREQUENCIES: readonly RepeatFrequency[] = ["daily", "weekly", "monthly", "yearly"];

export type AgendaNote = {
  kind: "note";
  file: TFile;
  title: string;
  dateId: string;
};

export type Task = {
  kind: "task";
  file: TFile;
  title: string;
  dateId?: string;
  done: boolean;
  completedDateId?: string;
  repeat?: RepeatRule;
  taskListId: string;
  taskLocation: TaskLocation;
};

export type Item = AgendaNote | Task;
export type ItemKind = Item["kind"];

export type ItemClassificationResult =
  | { type: "item"; item: Item }
  | { type: "invalid"; reason: string }
  | { type: "unrelated" };

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

export function normalizeDateId(value: unknown, settings: VaultAgendaSettings): string | null {
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

function normalizeKind(value: unknown): ItemKind | null {
  if (typeof value !== "string") {
    return null;
  }

  const kind = value.trim().toLowerCase() as ItemKind;

  return ITEM_KINDS.includes(kind) ? kind : null;
}

export function classifyItemFile(
  app: App,
  file: TFile,
  settings: VaultAgendaSettings,
): Item | null {
  const result = classifyItemFileDetailed(app, file, settings);

  return result.type === "item" ? result.item : null;
}

export function classifyItemFileDetailed(
  app: App,
  file: TFile,
  settings: VaultAgendaSettings,
): ItemClassificationResult {
  if (file.extension !== MARKDOWN_EXTENSION) {
    return { type: "unrelated" };
  }

  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

  if (!frontmatter) {
    return { type: "unrelated" };
  }

  const kind = normalizeKind(frontmatter[ITEM_MARKER_FIELD]);

  if (!kind) {
    return { type: "unrelated" };
  }

  const dateId = normalizeDateId(frontmatter.date, settings);

  if (kind === "note") {
    if (!isFileInsideFolder(file, settings.notesFolder)) {
      return { type: "unrelated" };
    }

    if (!dateId) {
      return { type: "invalid", reason: "Vault Agenda note requires a valid date." };
    }

    return {
      type: "item",
      item: {
        kind: "note",
        file,
        title: parseItemName(file.basename, settings).title,
        dateId,
      },
    };
  }

  const match = findTaskScope(file, settings);

  if (!match) {
    return { type: "unrelated" };
  }

  if (typeof frontmatter.done !== "boolean") {
    return { type: "invalid", reason: "Task requires a boolean done property." };
  }

  const completedDateId = normalizeDateId(frontmatter.completed, settings);
  const repeat = dateId ? normalizeRepeatRule(frontmatter) : null;
  const parsedName = parseItemName(file.basename, settings);
  const title = dateId && parsedName.dateId === dateId ? parsedName.title : file.basename;

  return {
    type: "item",
    item: {
      kind: "task",
      file,
      title,
      done: frontmatter.done,
      taskListId: match.taskList.id,
      taskLocation: match.location,
      ...(dateId ? { dateId } : {}),
      ...(completedDateId ? { completedDateId } : {}),
      ...(repeat ? { repeat } : {}),
    },
  };
}
