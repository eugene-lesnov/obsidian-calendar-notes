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
import type { RepeatFrequency } from "../core/types";
import type { CalendarItem, CalendarItemKind } from "../data/calendarItem";
import {
  createItem,
  setItemDate,
  setTaskRepeat,
} from "../data/itemMutations";
import { setTaskDone } from "../data/taskState";
import type CalendarNotesPlugin from "../main";
import { renderDaySection, renderOverdueSection } from "./daySection";
import { DatePickerModal } from "./DatePickerModal";
import { showItemMenu } from "./itemMenu";
import { renderMonthGrid } from "./monthGrid";

const RENDER_DEBOUNCE_MS = 250;

export class CalendarView extends ItemView {
  navigation = false;
  hoverPopover: HoverPopover | null = null;

  private year: number;
  private month: number;
  private selectedDateId: string;
  private overdueExpanded = false;

  readonly scheduleRender = debounce(() => this.render(), RENDER_DEBOUNCE_MS, false);

  constructor(leaf: WorkspaceLeaf, private readonly plugin: CalendarNotesPlugin) {
    super(leaf);

    const todayDateId = getTodayDateId();
    const today = parseDateId(todayDateId);

    this.year = today.year;
    this.month = today.month;
    this.selectedDateId = todayDateId;
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
      getCounts: (dateId) => this.plugin.index.getCounts(dateId),
      formatDayLabel: (dateId) => this.formatDayLabel(dateId),
      onSelectDate: (dateId) => this.selectDate(dateId),
      onPrevMonth: () => this.shiftMonth(-1),
      onNextMonth: () => this.shiftMonth(1),
      onToday: () => this.goToToday(),
    });

    const overdue = this.plugin.index.getOverdueTasks(todayDateId, {
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
      onToggleDone: (item, done) => void this.toggleDone(item, done),
      onOpen: (item, event) => this.openFile(item.file, event),
      onMenu: (item, event) => this.openItemMenu(item, event),
      formatDayLabel: (dateId) => this.formatDayLabel(dateId),
    });

    renderDaySection(root, {
      app: this.app,
      hoverParent: this,
      dateId: this.selectedDateId,
      items: this.plugin.index.getItems(this.selectedDateId),
      onCreateNote: () => void this.createItem("note"),
      onCreateTask: () => void this.createItem("task"),
      onToggleDone: (item, done) => void this.toggleDone(item, done),
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

  private openItemMenu(item: CalendarItem, event: MouseEvent): void {
    showItemMenu(this.app, event, item, {
      onOpen: (openEvent) => this.openFile(item.file, openEvent),
      onPickDate: () => this.openDatePicker(item),
      onSetRepeat: (frequency) => void this.applyRepeat(item, frequency),
      onCompleteAndStopRepeat: () => void this.stopRepeat(item),
    });
  }

  private openDatePicker(item: CalendarItem): void {
    new DatePickerModal(this.app, this.plugin.settings, item.dateId, (dateId) => {
      void this.moveItem(item, dateId);
    }).open();
  }

  private async moveItem(item: CalendarItem, dateId: string): Promise<void> {
    await this.runMutation(() => setItemDate(this.app, this.plugin.settings, item, dateId));
  }

  private async applyRepeat(
    item: CalendarItem,
    frequency: RepeatFrequency | null,
  ): Promise<void> {
    const rule = frequency ? { frequency } : null;

    await this.runMutation(() => setTaskRepeat(this.app, this.plugin.settings, item, rule));
  }

  private async stopRepeat(item: CalendarItem): Promise<void> {
    await this.runMutation(() =>
      setTaskDone(this.app, this.plugin.settings, item, true, { stopRepeat: true }),
    );
  }

  private toggleOverdueExpanded(): void {
    this.overdueExpanded = !this.overdueExpanded;
    this.render();
  }

  private async toggleDone(item: CalendarItem, done: boolean): Promise<void> {
    try {
      await setTaskDone(this.app, this.plugin.settings, item, done);
    } catch (error) {
      new Notice(String(error instanceof Error ? error.message : error));
      this.render();
    }
  }

  private async createItem(kind: CalendarItemKind): Promise<void> {
    await this.runMutation(async () => {
      const file = await createItem(this.app, this.plugin.settings, kind, this.selectedDateId);

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
