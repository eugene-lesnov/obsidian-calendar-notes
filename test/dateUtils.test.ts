import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildDateMatcher,
  daysInMonth,
  formatDateByPattern,
  formatDateId,
  getTodayDateId,
  isValidDateFormat,
  momentFormatToPattern,
  parseDateByPattern,
  parseDateId,
  weekdayLabels,
  weekOffset,
} from "../src/core/dateUtils";
import {
  buildDefaultNotesFolder,
  buildDefaultTemplatePath,
} from "../src/core/pathDefaults";
import { buildItemName, parseItemName } from "../src/data/itemName";
import { getNextRepeatDateId } from "../src/tasks/repeat";
import { createSettings } from "./fixtures";

describe("date utilities", () => {
  afterEach(() => vi.useRealTimers());

  it("formats and parses canonical date identifiers", () => {
    expect(formatDateId(2026, 0, 5)).toBe("2026-01-05");
    expect(parseDateId("2026-01-05")).toEqual({ year: 2026, month: 0, day: 5 });
  });

  it("uses the local calendar date for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 23, 30));
    expect(getTodayDateId()).toBe("2026-08-12");
  });

  it("parses supported tokens, literals and short years", () => {
    expect(parseDateByPattern("05.01.26", "{{DD}}.{{MM}}.{{YY}}"))
      .toEqual({ year: 2026, month: 0, day: 5 });
    expect(parseDateByPattern("day=5/month=1/year=2026", "day={{D}}/month={{M}}/year={{YYYY}}"))
      .toEqual({ year: 2026, month: 0, day: 5 });
  });

  it("rejects impossible and structurally incomplete dates", () => {
    expect(parseDateByPattern("2025-02-29", "{{YYYY-MM-DD}}")).toBeNull();
    expect(parseDateByPattern("2026-01", "{{YYYY-MM}}")).toBeNull();
    expect(buildDateMatcher("YYYY-MM")).toBeNull();
  });

  it("formats custom and fallback patterns", () => {
    const date = { year: 2026, month: 7, day: 3 };
    expect(formatDateByPattern(date, "{{DD.MM.YYYY}}")).toBe("03.08.2026");
    expect(formatDateByPattern(date, "")).toBe("2026-08-03");
    expect(momentFormatToPattern(" DD.MM.YYYY ")).toBe("{{DD.MM.YYYY}}");
    expect(momentFormatToPattern(" ")).toBe("{{YYYY-MM-DD}}");
  });

  it("validates round-trippable formats", () => {
    expect(isValidDateFormat("YYYY-MM-DD")).toBe(true);
    expect(isValidDateFormat("DD.MM.YYYY")).toBe(true);
    expect(isValidDateFormat("YYYY-MM")).toBe(false);
    expect(isValidDateFormat(" ")).toBe(false);
  });

  it("handles leap years, week starts and weekday labels", () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2025, 1)).toBe(28);
    const sunday = new Date(2026, 7, 9);
    expect(weekOffset(sunday, "sunday")).toBe(0);
    expect(weekOffset(sunday, "monday")).toBe(6);
    expect(weekdayLabels("monday")).toHaveLength(7);
    expect(weekdayLabels("sunday")).toHaveLength(7);
  });
});

describe("item names and defaults", () => {
  it("round-trips configured date prefixes", () => {
    const settings = createSettings({ dateFormat: "DD.MM.YYYY" });
    const name = buildItemName(settings, "2026-08-12", "Review");
    expect(name).toBe("12.08.2026 - Review");
    expect(parseItemName(name, settings)).toEqual({ dateId: "2026-08-12", title: "Review" });
  });

  it("sanitizes forbidden filename characters in the date and title", () => {
    const settings = createSettings({ dateFormat: "YYYY/MM/DD" });
    expect(buildItemName(settings, "2026-08-12", "A/B:C"))
      .toBe("2026-08-12 - A-B-C");
    expect(parseItemName("not a dated item", settings))
      .toEqual({ dateId: null, title: "not a dated item" });
  });

  it("does not parse impossible dates or empty titles", () => {
    const settings = createSettings();
    expect(parseItemName("2025-02-29 - Task", settings).dateId).toBeNull();
    expect(parseItemName("2026-08-12 - ", settings).dateId).toBeNull();
  });

  it("builds default vault paths", () => {
    expect(buildDefaultNotesFolder("Notes")).toBe("Vault Agenda/Notes");
    expect(buildDefaultTemplatePath("Templates", "Task")).toBe("Templates/Task.md");
  });
});

describe("repeat dates", () => {
  it.each([
    ["daily", "2026-08-10", "2026-08-12", "2026-08-13"],
    ["weekly", "2026-08-01", "2026-08-12", "2026-08-15"],
    ["monthly", "2026-01-31", "2026-01-31", "2026-02-28"],
    ["yearly", "2024-02-29", "2024-02-29", "2025-02-28"],
  ] as const)("advances %s repeats to the first future occurrence", (
    frequency,
    dateId,
    todayId,
    expected,
  ) => {
    expect(getNextRepeatDateId(dateId, { frequency }, todayId)).toBe(expected);
  });
});
