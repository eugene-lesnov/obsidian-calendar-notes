import type { App } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import strings from "../src/core/localization";
import { showItemMenu, type ItemMenuCallbacks } from "../src/view/itemMenu";
import { addTask } from "./fixtures";
import { FakeApp, Menu } from "./obsidian";

describe("item menu", () => {
  beforeEach(() => {
    Menu.instances = [];
  });

  it("shows repeat options for an unscheduled task", () => {
    const app = new FakeApp();
    const task = addTask(app, "Active/Task.md");
    const callbacks: ItemMenuCallbacks = {
      onOpen: vi.fn(),
      onSetDate: vi.fn(),
      onUnschedule: vi.fn(),
      onSetRepeat: vi.fn(),
      onCompleteAndStopRepeat: vi.fn(),
    };

    showItemMenu(app as unknown as App, {} as MouseEvent, task, callbacks);

    const menu = Menu.instances[0];
    const repeatItems = menu.items.filter((item) => item.section === "vault-agenda-repeat");

    expect(repeatItems.map((item) => item.title)).toEqual([
      strings.taskRepeatNoneLabel,
      strings.taskRepeatDailyLabel,
      strings.taskRepeatWeeklyLabel,
      strings.taskRepeatMonthlyLabel,
      strings.taskRepeatYearlyLabel,
    ]);
    expect(repeatItems[0]?.checked).toBe(true);
  });
});
