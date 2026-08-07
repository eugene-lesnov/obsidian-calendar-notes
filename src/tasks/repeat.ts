import { daysInMonth, formatDateId, parseDateId } from "../core/dateUtils";
import type { RepeatFrequency, RepeatRule } from "../core/types";

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const targetDay = Math.min(date.getDate(), daysInMonth(targetYear, targetMonth));

  return new Date(targetYear, targetMonth, targetDay);
}

function addYearsClamped(date: Date, years: number): Date {
  const targetYear = date.getFullYear() + years;
  const targetMonth = date.getMonth();
  const targetDay = Math.min(date.getDate(), daysInMonth(targetYear, targetMonth));

  return new Date(targetYear, targetMonth, targetDay);
}

function addRepeatInterval(
  date: Date,
  frequency: RepeatFrequency,
): Date {
  if (frequency === "daily") {
    return addDays(date, 1);
  }

  if (frequency === "weekly") {
    return addDays(date, 7);
  }

  if (frequency === "monthly") {
    return addMonthsClamped(date, 1);
  }

  return addYearsClamped(date, 1);
}

function dateIdToLocalDate(dateId: string): Date {
  const { year, month, day } = parseDateId(dateId);

  return new Date(year, month, day);
}

function localDateToDateId(date: Date): string {
  return formatDateId(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getNextRepeatDateId(
  dateId: string,
  repeat: RepeatRule,
  todayId: string,
): string {
  let nextDate = addRepeatInterval(
    dateIdToLocalDate(dateId),
    repeat.frequency,
  );

  while (localDateToDateId(nextDate) <= todayId) {
    nextDate = addRepeatInterval(nextDate, repeat.frequency);
  }

  return localDateToDateId(nextDate);
}
