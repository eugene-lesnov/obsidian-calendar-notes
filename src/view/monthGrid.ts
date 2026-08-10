import { setIcon } from "obsidian";

import {
  daysInMonth,
  formatDateId,
  weekOffset,
  weekdayLabels,
} from "../core/dateUtils";
import strings, { getLocales } from "../core/localization";
import type { WeekStart } from "../core/types";
import type { CalendarDayCounts } from "../data/itemIndex";

export type MonthGridParams = {
  year: number;
  month: number;
  weekStart: WeekStart;
  selectedDateId: string | null;
  todayDateId: string;
  getDayCounts: (dateId: string) => CalendarDayCounts;
  formatDayLabel: (dateId: string) => string;
  onSelectDate: (dateId: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

const MONTH_LABEL_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "long",
};

function formatMonthLabel(year: number, month: number): string {
  const formatter = new Intl.DateTimeFormat(getLocales(), MONTH_LABEL_FORMAT_OPTIONS);
  const monthName = formatter.format(new Date(year, month, 1));

  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

function createNavButton(
  parent: HTMLElement,
  icon: string,
  label: string,
  onClick: () => void,
): void {
  const button = parent.createEl("button", { cls: "calendar-nav-button" });

  button.setAttribute("aria-label", label);
  setIcon(button, icon);
  button.addEventListener("click", onClick);
}

function renderHeader(container: HTMLElement, params: MonthGridParams): void {
  const header = container.createDiv({ cls: "calendar-header" });

  createNavButton(header, "chevron-left", strings.previousMonthTitle, params.onPrevMonth);

  header.createDiv({
    cls: "calendar-month-label",
    text: formatMonthLabel(params.year, params.month),
  });

  const todayButton = header.createEl("button", {
    cls: "calendar-today-button",
    text: strings.todayButtonLabel,
  });

  todayButton.setAttribute("aria-label", params.formatDayLabel(params.todayDateId));
  todayButton.addEventListener("click", params.onToday);

  createNavButton(header, "chevron-right", strings.nextMonthTitle, params.onNextMonth);
}

function renderWeekdays(container: HTMLElement, weekStart: WeekStart): void {
  const weekdays = container.createDiv({ cls: "calendar-weekdays" });

  weekdayLabels(weekStart).forEach((label) => {
    weekdays.createDiv({ text: label });
  });
}

function renderDayMarkers(dayButton: HTMLElement, counts: CalendarDayCounts): void {
  if (counts.notes <= 0 && counts.tasks <= 0) {
    return;
  }

  const markers = dayButton.createSpan({ cls: "calendar-day-markers" });

  if (counts.notes > 0) {
    markers.createSpan({ cls: "calendar-day-marker calendar-note-marker" });
  }

  if (counts.tasks > 0) {
    const taskMarkerClass = counts.hasActiveTasks
      ? "calendar-task-active-marker"
      : "calendar-task-done-marker";

    markers.createSpan({ cls: `calendar-day-marker ${taskMarkerClass}` });
  }
}

function renderDays(container: HTMLElement, params: MonthGridParams): void {
  const grid = container.createDiv({ cls: "calendar-grid" });
  const firstDayOffset = weekOffset(new Date(params.year, params.month, 1), params.weekStart);
  const totalDays = daysInMonth(params.year, params.month);

  for (let index = 0; index < firstDayOffset; index++) {
    grid.createDiv({ cls: "calendar-day calendar-day-empty" });
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateId = formatDateId(params.year, params.month, day);
    const counts = params.getDayCounts(dateId);
    const dayButton = grid.createEl("button", { cls: "calendar-day" });

    dayButton.createSpan({ cls: "calendar-day-number", text: String(day) });
    renderDayMarkers(dayButton, counts);

    dayButton.toggleClass("is-today", dateId === params.todayDateId);
    dayButton.toggleClass("is-selected", dateId === params.selectedDateId);

    dayButton.addEventListener("click", () => params.onSelectDate(dateId));
  }
}

export function renderMonthGrid(container: HTMLElement, params: MonthGridParams): void {
  renderHeader(container, params);
  renderWeekdays(container, params.weekStart);
  renderDays(container, params);
}
