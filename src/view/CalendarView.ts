import {
  HoverPopover,
  ItemView,
  Keymap,
  Notice,
  TFile,
  WorkspaceLeaf,
  debounce,
} from "obsidian";

import { RIBBON_ICON, VIEW_TYPE_CALENDAR } from "../core/constants";
import {
  formatDateByPattern,
  getTodayDateId,
  momentFormatToPattern,
  parseDateId,
} from "../core/dateUtils";
import strings from "../core/localization";
import type { RepeatFrequency, TaskList } from "../core/types";
import type { Item, ItemKind, Task } from "../data/item";
import {
  createDatedItem,
  createTask,
  setItemDate,
  setTaskRepeat,
  unscheduleTask,
} from "../data/itemMutations";
import { setTaskCompleted } from "../data/taskCompletion";
import type CalendarNotesPlugin from "../main";
import { renderDaySection, renderOverdueSection } from "./daySection";
import { DatePickerModal } from "./DatePickerModal";
import { ConfirmUnscheduleModal } from "./ConfirmUnscheduleModal";
import { showItemMenu } from "./itemMenu";
import { renderMonthGrid } from "./monthGrid";
import { renderTaskListsSection } from "./taskListsSection";

const RENDER_DEBOUNCE_MS = 250;

export class CalendarView extends ItemView {
  navigation = false;
  hoverPopover: HoverPopover | null = null;

  private year: number;
  private month: number;
  private selectedDateId: string;
  private overdueExpanded = false;
  private readonly expandedTaskLists: Set<string>;

  readonly scheduleRender = debounce(() => this.render(), RENDER_DEBOUNCE_MS, false);

  constructor(leaf: WorkspaceLeaf, private readonly plugin: CalendarNotesPlugin) {
    super(leaf);

    const todayDateId = getTodayDateId();
    const today = parseDateId(todayDateId);

    this.year = today.year;
    this.month = today.month;
    this.selectedDateId = todayDateId;
    this.expandedTaskLists = new Set(plugin.settings.expandedTaskListIds);
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR;
  }

  getDisplayText(): string {
    return strings.calendarViewTitle;
  }

  getIcon(): string {
    return RIBBON_ICON;
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.scheduleRender.cancel();
  }

  render(): void {
    const root = this.contentEl;
    const todayDateId = getTodayDateId();

    root.empty();
    root.addClass("calendar-notes-root");

    renderMonthGrid(root, {
      year: this.year,
      month: this.month,
      weekStart: this.plugin.settings.weekStart,
      selectedDateId: this.selectedDateId,
      todayDateId,
      getDayCounts: (dateId) => this.plugin.itemIndex.getDayCounts(dateId),
      formatDayLabel: (dateId) => this.formatDayLabel(dateId),
      onSelectDate: (dateId) => this.selectDate(dateId),
      onPrevMonth: () => this.shiftMonth(-1),
      onNextMonth: () => this.shiftMonth(1),
      onToday: () => this.goToToday(),
    });

    const overdue = this.plugin.itemIndex.getOverdueTasks(todayDateId, {
      excludeDateId: this.selectedDateId,
      ...(!this.overdueExpanded ? { limit: 3 } : {}),
    });

    renderOverdueSection(root, {
      app: this.app,
      hoverParent: this,
      items: overdue.items,
      total: overdue.total,
      expanded: this.overdueExpanded,
      onToggleExpanded: () => this.toggleOverdueExpanded(),
      onToggleTaskCompleted: (item, completed) =>
        void this.toggleTaskCompleted(item, completed),
      onOpen: (item, event) => this.openFile(item.file, event),
      onMenu: (item, event) => this.openItemMenu(item, event),
      formatDayLabel: (dateId) => this.formatDayLabel(dateId),
    });

    renderTaskListsSection(root, {
      app: this.app,
      hoverParent: this,
      taskLists: this.plugin.settings.taskLists,
      getTasks: (taskListId) => this.plugin.itemIndex.getActiveTasks(taskListId),
      isExpanded: (taskListId) => this.expandedTaskLists.has(taskListId),
      onToggleExpanded: (taskListId) => this.toggleTaskList(taskListId),
      onCreateTask: (taskList) => void this.createTaskInList(taskList),
      onToggleTaskCompleted: (item, completed) =>
        void this.toggleTaskCompleted(item, completed),
      onOpen: (item, event) => this.openFile(item.file, event),
      onMenu: (item, event) => this.openItemMenu(item, event),
    });

    renderDaySection(root, {
      app: this.app,
      hoverParent: this,
      dateId: this.selectedDateId,
      items: this.plugin.itemIndex.getItemsByDate(this.selectedDateId),
      onCreateNote: () => void this.createDatedItem("note"),
      onCreateTask: () => void this.createDatedItem("task"),
      onToggleTaskCompleted: (item, completed) =>
        void this.toggleTaskCompleted(item, completed),
      onOpen: (item, event) => this.openFile(item.file, event),
      onMenu: (item, event) => this.openItemMenu(item, event),
      formatDayLabel: (dateId) => this.formatDayLabel(dateId),
    });
  }

  selectDay(dateId: string): void {
    const date = parseDateId(dateId);

    this.year = date.year;
    this.month = date.month;
    this.selectedDateId = dateId;
    this.render();
  }

  private openItemMenu(item: Item, event: MouseEvent): void {
    showItemMenu(this.app, event, item, {
      onOpen: (openEvent) => this.openFile(item.file, openEvent),
      onSetDate: () => this.openDatePicker(item),
      onUnschedule: () => this.unschedule(item),
      onSetRepeat: (frequency) => void this.applyRepeat(item, frequency),
      onCompleteAndStopRepeat: () => void this.stopRepeat(item),
    });
  }

  private openDatePicker(item: Item): void {
    new DatePickerModal(this.app, this.plugin.settings, item.dateId ?? getTodayDateId(), (dateId) => {
      void this.setItemDate(item, dateId);
    }).open();
  }

  private async setItemDate(item: Item, dateId: string): Promise<void> {
    await this.runMutation(() => setItemDate(this.app, this.plugin.settings, item, dateId));
  }

  private async applyRepeat(
    item: Item,
    frequency: RepeatFrequency | null,
  ): Promise<void> {
    if (item.kind !== "task") {
      return;
    }

    const rule = frequency ? { frequency } : null;

    await this.runMutation(() => setTaskRepeat(this.app, this.plugin.settings, item, rule));
  }

  private async stopRepeat(item: Item): Promise<void> {
    if (item.kind !== "task") {
      return;
    }

    await this.runMutation(() =>
      setTaskCompleted(this.app, this.plugin.settings, item, true, { stopRepeat: true }),
    );
  }

  private toggleOverdueExpanded(): void {
    this.overdueExpanded = !this.overdueExpanded;
    this.render();
  }

  private async toggleTaskCompleted(item: Task, completed: boolean): Promise<void> {
    try {
      await setTaskCompleted(this.app, this.plugin.settings, item, completed);
    } catch (error) {
      new Notice(String(error instanceof Error ? error.message : error));
      this.render();
    }
  }

  private unschedule(item: Item): void {
    if (item.kind !== "task" || !item.dateId) {
      return;
    }

    const apply = (): void => {
      void this.runMutation(() => unscheduleTask(this.app, this.plugin.settings, item));
    };

    if (item.repeat) {
      new ConfirmUnscheduleModal(this.app, apply).open();
    } else {
      apply();
    }
  }

  private toggleTaskList(taskListId: string): void {
    if (this.expandedTaskLists.has(taskListId)) {
      this.expandedTaskLists.delete(taskListId);
    } else {
      this.expandedTaskLists.add(taskListId);
    }

    this.plugin.settings.expandedTaskListIds = Array.from(this.expandedTaskLists);
    void this.plugin.saveSettings();
    this.render();
  }

  private async createTaskInList(taskList: TaskList): Promise<void> {
    await this.runMutation(async () => {
      const file = await createTask(this.app, this.plugin.settings, taskList);
      await this.app.workspace.getLeaf(false).openFile(file);
    });
  }

  private async createDatedItem(kind: ItemKind): Promise<void> {
    await this.runMutation(async () => {
      const file = await createDatedItem(this.app, this.plugin.settings, kind, this.selectedDateId);

      await this.app.workspace.getLeaf(false).openFile(file);
    });
  }

  private async runMutation(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      new Notice(String(error instanceof Error ? error.message : error));
    }
  }

  private formatDayLabel(dateId: string): string {
    const pattern = momentFormatToPattern(this.plugin.settings.dateFormat);

    return formatDateByPattern(parseDateId(dateId), pattern);
  }

  private selectDate(dateId: string): void {
    this.selectedDateId = dateId;
    this.render();
  }

  private shiftMonth(delta: number): void {
    const shifted = new Date(this.year, this.month + delta, 1);

    this.year = shifted.getFullYear();
    this.month = shifted.getMonth();
    this.render();
  }

  private goToToday(): void {
    this.selectDay(getTodayDateId());
  }

  private openFile(file: TFile, event: MouseEvent | KeyboardEvent): void {
    void this.app.workspace.getLeaf(Keymap.isModEvent(event)).openFile(file);
  }
}
