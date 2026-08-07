import { App, Menu } from "obsidian";

import { HOVER_LINK_SOURCE } from "../core/constants";
import strings from "../core/localization";
import type { RepeatFrequency } from "../core/types";
import type { CalendarItem } from "../data/calendarItem";

const MOVE_MENU_SECTION = "calendar-notes-move";
const REPEAT_MENU_SECTION = "calendar-notes-repeat";

const REPEAT_OPTIONS: Array<{ frequency: RepeatFrequency | null; label: () => string }> = [
  { frequency: null, label: () => strings.taskRepeatNoneLabel },
  { frequency: "daily", label: () => strings.taskRepeatDailyLabel },
  { frequency: "weekly", label: () => strings.taskRepeatWeeklyLabel },
  { frequency: "monthly", label: () => strings.taskRepeatMonthlyLabel },
  { frequency: "yearly", label: () => strings.taskRepeatYearlyLabel },
];

export type ItemMenuCallbacks = {
  onOpen: (event: MouseEvent | KeyboardEvent) => void;
  onPickDate: () => void;
  onSetRepeat: (frequency: RepeatFrequency | null) => void;
  onCompleteAndStopRepeat: () => void;
};

export function showItemMenu(
  app: App,
  event: MouseEvent,
  item: CalendarItem,
  callbacks: ItemMenuCallbacks,
): void {
  const menu = new Menu();

  menu.addItem((menuItem) =>
    menuItem
      .setTitle(strings.moveItemPickDateLabel)
      .setSection(MOVE_MENU_SECTION)
      .setIcon("calendar")
      .onClick(() => callbacks.onPickDate()),
  );

  if (item.kind === "task") {
    const currentFrequency = item.repeat?.frequency ?? null;

    REPEAT_OPTIONS.forEach((option) => {
      menu.addItem((menuItem) =>
        menuItem
          .setTitle(option.label())
          .setSection(REPEAT_MENU_SECTION)
          .setChecked(option.frequency === currentFrequency)
          .onClick(() => callbacks.onSetRepeat(option.frequency)),
      );
    });

    if (item.repeat) {
      menu.addItem((menuItem) =>
        menuItem
          .setTitle(strings.completeAndStopRepeatLabel)
          .setSection(REPEAT_MENU_SECTION)
          .setIcon("check-check")
          .onClick(() => callbacks.onCompleteAndStopRepeat()),
      );
    }
  }

  menu.addItem((menuItem) =>
    menuItem
      .setTitle(strings.openItemLabel)
      .setIcon("file-text")
      .onClick((clickEvent) => callbacks.onOpen(clickEvent)),
  );

  app.workspace.trigger("file-menu", menu, item.file, HOVER_LINK_SOURCE);

  menu.showAtMouseEvent(event);
}
