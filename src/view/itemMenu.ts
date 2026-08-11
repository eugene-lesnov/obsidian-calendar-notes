import { App, Menu } from "obsidian";

import { HOVER_LINK_SOURCE } from "../core/constants";
import strings from "../core/localization";
import type { RepeatFrequency } from "../core/types";
import type { Item } from "../data/item";

const DATE_MENU_SECTION = "vault-agenda-date";
const REPEAT_MENU_SECTION = "vault-agenda-repeat";
const ORDER_MENU_SECTION = "vault-agenda-order";

const REPEAT_OPTIONS: Array<{ frequency: RepeatFrequency | null; label: () => string }> = [
  { frequency: null, label: () => strings.taskRepeatNoneLabel },
  { frequency: "daily", label: () => strings.taskRepeatDailyLabel },
  { frequency: "weekly", label: () => strings.taskRepeatWeeklyLabel },
  { frequency: "monthly", label: () => strings.taskRepeatMonthlyLabel },
  { frequency: "yearly", label: () => strings.taskRepeatYearlyLabel },
];

export type ItemMenuCallbacks = {
  onOpen: (event: MouseEvent | KeyboardEvent) => void;
  onSetDate: () => void;
  onUnschedule: () => void;
  onSetRepeat: (frequency: RepeatFrequency | null) => void;
  onCompleteAndStopRepeat: () => void;
  manualOrder?: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMoveToTop: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onMoveToBottom: () => void;
  };
};

export function showItemMenu(
  app: App,
  event: MouseEvent,
  item: Item,
  callbacks: ItemMenuCallbacks,
): void {
  const menu = new Menu();

  menu.addItem((menuItem) =>
    menuItem
      .setTitle(strings.setItemDateLabel)
      .setSection(DATE_MENU_SECTION)
      .setIcon("calendar")
      .onClick(() => callbacks.onSetDate()),
  );

  if (item.kind === "task") {
    if (item.dateId) {
      menu.addItem((menuItem) => menuItem
        .setTitle(strings.unscheduleTaskLabel)
        .setSection(DATE_MENU_SECTION)
        .setIcon("calendar-x")
        .onClick(() => callbacks.onUnschedule()));
    }

    const currentFrequency = item.repeat?.frequency ?? null;

    if (item.dateId) {
      REPEAT_OPTIONS.forEach((option) => {
        menu.addItem((menuItem) =>
          menuItem
            .setTitle(option.label())
            .setSection(REPEAT_MENU_SECTION)
            .setChecked(option.frequency === currentFrequency)
            .onClick(() => callbacks.onSetRepeat(option.frequency)),
        );
      });
    }

    if (item.repeat) {
      menu.addItem((menuItem) =>
        menuItem
          .setTitle(strings.completeAndStopRepeatLabel)
          .setSection(REPEAT_MENU_SECTION)
          .setIcon("check-check")
          .onClick(() => callbacks.onCompleteAndStopRepeat()),
      );
    }

    if (callbacks.manualOrder) {
      const order = callbacks.manualOrder;

      menu.addItem((menuItem) => menuItem
        .setTitle(strings.moveTaskToTopLabel)
        .setSection(ORDER_MENU_SECTION)
        .setIcon("chevrons-up")
        .setDisabled(!order.canMoveUp)
        .onClick(order.onMoveToTop));
      menu.addItem((menuItem) => menuItem
        .setTitle(strings.moveTaskUpLabel)
        .setSection(ORDER_MENU_SECTION)
        .setIcon("chevron-up")
        .setDisabled(!order.canMoveUp)
        .onClick(order.onMoveUp));
      menu.addItem((menuItem) => menuItem
        .setTitle(strings.moveTaskDownLabel)
        .setSection(ORDER_MENU_SECTION)
        .setIcon("chevron-down")
        .setDisabled(!order.canMoveDown)
        .onClick(order.onMoveDown));
      menu.addItem((menuItem) => menuItem
        .setTitle(strings.moveTaskToBottomLabel)
        .setSection(ORDER_MENU_SECTION)
        .setIcon("chevrons-down")
        .setDisabled(!order.canMoveDown)
        .onClick(order.onMoveToBottom));
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
