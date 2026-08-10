import {
  buildDateMatcher,
  daysInMonth,
  formatDateByPattern,
  formatDateId,
  momentFormatToPattern,
  parseDateId,
} from "../core/dateUtils";
import type { VaultAgendaSettings } from "../core/types";
import { replaceForbiddenChars, sanitizeFileName } from "./fileNames";

const NAME_SEPARATOR = " - ";

type ParsedName = {
  dateId: string | null;
  title: string;
};

type NameMatcher = {
  regex: RegExp;
  dateFields: ("year" | "month" | "day")[];
  nameGroup: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveDateId(year: number, month: number, day: number): string | null {
  const fullYear = year < 100 ? year + 2000 : year;

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(fullYear, month - 1)) {
    return null;
  }

  return formatDateId(fullYear, month - 1, day);
}

export function buildItemName(settings: VaultAgendaSettings, dateId: string, title: string): string {
  const dateText = formatDateByPattern(
    parseDateId(dateId),
    momentFormatToPattern(settings.dateFormat),
  );

  return sanitizeFileName(`${dateText}${NAME_SEPARATOR}${title}`);
}

function buildNameMatcher(dateFormat: string): NameMatcher | null {
  const dateMatcher = buildDateMatcher(replaceForbiddenChars(dateFormat));

  if (!dateMatcher) {
    return null;
  }

  const source = `^${dateMatcher.source}${escapeRegExp(replaceForbiddenChars(NAME_SEPARATOR))}(.+)$`;

  return {
    regex: new RegExp(source),
    dateFields: dateMatcher.fields,
    nameGroup: dateMatcher.fields.length + 1,
  };
}

export function parseItemName(basename: string, settings: VaultAgendaSettings): ParsedName {
  const matcher = buildNameMatcher(settings.dateFormat);

  if (!matcher) {
    return { dateId: null, title: basename };
  }

  const match = matcher.regex.exec(basename);

  if (!match) {
    return { dateId: null, title: basename };
  }

  let year = 0;
  let month = 0;
  let day = 0;

  matcher.dateFields.forEach((field, offset) => {
    const value = Number(match[offset + 1]);

    if (field === "year") {
      year = value;
    } else if (field === "month") {
      month = value;
    } else {
      day = value;
    }
  });

  const dateId = resolveDateId(year, month, day);
  const title = match[matcher.nameGroup].trim();

  if (!dateId) {
    return { dateId: null, title: basename };
  }

  return { dateId, title: title || basename };
}
