import {
  HoverPopover,
  ItemView,
  Keymap,
  Notice,
  TFile,
  WorkspaceLeaf,
  debounce,
} from "obsidian";

import { RIBBON_ICON, VIEW_TYPE_AGENDA } from "../core/constants";
import {
  formatDateByPattern,
  getTodayDateId,
  momentFormatToPattern,
  parseDateId,
} from "../core/dateUtils";
import strings from "../core/localization";
import type { RepeatFrequency, TaskList, TaskListColor, TaskOrder } from "../core/types";
import type { Item, ItemKind, Task } from "../data/item";
import {
  createDatedItem,
  createTask,
  setItemDate,
  setTaskRepeat,
  unscheduleTask,
} from "../data/itemMutations";
import { setTaskCompleted } from "../data/taskCompletion";
import { initializeManualOrder, orderTasks } from "../data/taskOrdering";
import type VaultAgendaPlugin from "../main";
import { renderDaySection, renderOverdueSection } from "./daySection";
import { DatePickerModal } from "./DatePickerModal";
import { ConfirmUnscheduleModal } from "./ConfirmUnscheduleModal";
import { showItemMenu } from "./itemMenu";
import { renderMonthGrid } from "./monthGrid";
import { renderTaskListsSection } from "./taskListsSection";

const RENDER_DEBOUNCE_MS = 250;

export class AgendaView extends ItemView {
  navigation = false;
  hoverPopover: HoverPopover | null = null;

  private year: number;
  private month: number;
  private selectedDateId: string;
  private overdueExpanded = false;
  private taskListsExpanded = true;
  private readonly expandedTaskLists: Set<string>;

  readonly scheduleRender = debounce(() => this.render(), RENDER_DEBOUNCE_MS, false);

  constructor(leaf: WorkspaceLeaf, private readonly plugin: VaultAgendaPlugin) {
    super(leaf);

    const todayDateId = getTodayDateId();
    const today = parseDateId(todayDateId);

    this.year = today.year;
    this.month = today.month;
    this.selectedDateId = todayDateId;
    this.expandedTaskLists = new Set(plugin.settings.expandedTaskListIds);
  }

  getViewType(): string {
    return VIEW_TYPE_AGENDA;
  }

  getDisplayText(): string {
    return strings.agendaViewTitle;
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

    this.syncExpandedTaskLists();

    root.empty();
    root.addClass("vault-agenda-root");

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
      getTaskListColor: (taskListId) => this.getTaskListColor(taskListId),
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
      expanded: this.taskListsExpanded,
      todayDateId,
      formatDayLabel: (dateId) => this.formatDayLabel(dateId),
      getTaskListColor: (taskListId) => this.getTaskListColor(taskListId),
      getTasks: (taskListId) => {
        const taskList = this.plugin.settings.taskLists.find((list) => list.id === taskListId);
        const tasks = this.plugin.itemIndex.getActiveTasks(taskListId);

        return taskList ? orderTasks(taskList, tasks) : tasks;
      },
      isExpanded: (taskListId) => this.expandedTaskLists.has(taskListId),
      onToggleSectionExpanded: () => this.toggleTaskListsExpanded(),
      onToggleTaskListExpanded: (taskListId) => this.toggleTaskList(taskListId),
      onSetupTaskList: () => void this.setupTaskList(),
      onCreateTask: (taskList) => void this.createTaskInList(taskList),
      onSetOrder: (taskList, order) => void this.setTaskOrder(taskList, order),
      onReorderTask: (taskList, sourcePath, targetPath, after) =>
        void this.reorderTask(taskList, sourcePath, targetPath, after),
      onTaskMenu: (taskList, task, event) => this.openItemMenu(task, event, taskList),
      onToggleTaskCompleted: (item, completed) =>
        void this.toggleTaskCompleted(item, completed),
      onOpen: (item, event) => this.openFile(item.file, event),
    });

    renderDaySection(root, {
      app: this.app,
      hoverParent: this,
      dateId: this.selectedDateId,
      items: this.plugin.itemIndex.getItemsByDate(this.selectedDateId),
      getTaskListColor: (taskListId) => this.getTaskListColor(taskListId),
      onCreateNote: () => void this.createDatedItem("note"),
      onCreateTask: () => void this.createDatedItem("task"),
      onToggleTaskCompleted: (item, completed) =>
        void this.toggleTaskCompleted(item, completed),
      onOpen: (item, event) => this.openFile(item.file, event),
      onMenu: (item, event) => this.openItemMenu(item, event),
      formatDayLabel: (dateId) => this.formatDayLabel(dateId),
    });
  }

  private getTaskListColor(taskListId: string): TaskListColor {
    return this.plugin.settings.taskLists.find((taskList) => taskList.id === taskListId)?.color
      ?? null;
  }

  selectDay(dateId: string): void {
    const date = parseDateId(dateId);

    this.year = date.year;
    this.month = date.month;
    this.selectedDateId = dateId;
    this.render();
  }

  private openItemMenu(item: Item, event: MouseEvent, taskList?: TaskList): void {
    const orderedTasks = taskList?.order === "manual"
      ? orderTasks(taskList, this.plugin.itemIndex.getActiveTasks(taskList.id))
      : [];
    const taskIndex = item.kind === "task"
      ? orderedTasks.findIndex((task) => task.file.path === item.file.path)
      : -1;

    showItemMenu(this.app, event, item, {
      onOpen: (openEvent) => this.openFile(item.file, openEvent),
      onSetDate: () => this.openDatePicker(item),
      onUnschedule: () => this.unschedule(item),
      onSetRepeat: (frequency) => void this.applyRepeat(item, frequency),
      onCompleteAndStopRepeat: () => void this.stopRepeat(item),
      ...(taskList?.order === "manual" && taskIndex >= 0 ? {
        manualOrder: {
          canMoveUp: taskIndex > 0,
          canMoveDown: taskIndex < orderedTasks.length - 1,
          onMoveToTop: () => void this.moveTask(taskList, orderedTasks, taskIndex, "top"),
          onMoveUp: () => void this.moveTask(taskList, orderedTasks, taskIndex, "up"),
          onMoveDown: () => void this.moveTask(taskList, orderedTasks, taskIndex, "down"),
          onMoveToBottom: () => void this.moveTask(taskList, orderedTasks, taskIndex, "bottom"),
        },
      } : {}),
    });
  }

  private async setTaskOrder(taskList: TaskList, order: TaskOrder): Promise<void> {
    if (taskList.order === order) {
      return;
    }

    if (order === "manual") {
      taskList.manualOrder = initializeManualOrder(
        taskList,
        this.plugin.itemIndex.getActiveTasks(taskList.id),
      );
    }

    taskList.order = order;
    await this.runMutation(() => this.plugin.saveSettings());
  }

  private async reorderTask(
    taskList: TaskList,
    sourcePath: string,
    targetPath: string,
    after: boolean,
  ): Promise<void> {
    if (taskList.order !== "manual" || sourcePath === targetPath) {
      return;
    }

    const activePaths = this.plugin.itemIndex.getActiveTasks(taskList.id)
      .map((task) => task.file.path);
    const allPaths = [...taskList.manualOrder];

    activePaths.forEach((path) => {
      if (!allPaths.includes(path)) {
        allPaths.push(path);
      }
    });

    const sourceIndex = allPaths.indexOf(sourcePath);

    if (sourceIndex < 0 || !allPaths.includes(targetPath)) {
      return;
    }

    allPaths.splice(sourceIndex, 1);
    const targetIndex = allPaths.indexOf(targetPath);
    allPaths.splice(targetIndex + (after ? 1 : 0), 0, sourcePath);
    taskList.manualOrder = allPaths;
    await this.runMutation(() => this.plugin.saveSettings());
  }

  private async moveTask(
    taskList: TaskList,
    tasks: Task[],
    index: number,
    destination: "top" | "up" | "down" | "bottom",
  ): Promise<void> {
    const source = tasks[index];

    if (!source) {
      return;
    }

    if (destination === "top" && tasks[0]) {
      await this.reorderTask(taskList, source.file.path, tasks[0].file.path, false);
    } else if (destination === "up" && tasks[index - 1]) {
      await this.reorderTask(taskList, source.file.path, tasks[index - 1].file.path, false);
    } else if (destination === "down" && tasks[index + 1]) {
      await this.reorderTask(taskList, source.file.path, tasks[index + 1].file.path, true);
    } else if (destination === "bottom" && tasks.at(-1)) {
      await this.reorderTask(taskList, source.file.path, tasks.at(-1)!.file.path, true);
    }
  }

  private openDatePicker(item: Item): void {
    new DatePickerModal(this.app, item.dateId ?? getTodayDateId(), (dateId) => {
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

    if (rule && !item.dateId) {
      new DatePickerModal(this.app, getTodayDateId(), (dateId) => {
        void this.runMutation(() =>
          setTaskRepeat(this.app, this.plugin.settings, item, rule, dateId));
      }).open();

      return;
    }

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

  private toggleTaskListsExpanded(): void {
    this.taskListsExpanded = !this.taskListsExpanded;
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
      let file: TFile;

      if (kind === "task") {
        const taskList = await this.plugin.selectTaskList(strings.setupAndCreateTaskLabel);

        if (!taskList) {
          return;
        }

        this.expandedTaskLists.add(taskList.id);
        file = await createTask(this.app, this.plugin.settings, taskList, this.selectedDateId);
      } else {
        file = await createDatedItem(this.app, this.plugin.settings, kind, this.selectedDateId);
      }

      await this.app.workspace.getLeaf(false).openFile(file);
    });
  }

  private async setupTaskList(): Promise<void> {
    const taskList = await this.plugin.promptTaskListSetup(strings.setupTaskListLabel);

    if (taskList) {
      this.expandedTaskLists.add(taskList.id);
      this.render();
    }
  }

  private syncExpandedTaskLists(): void {
    const taskListIds = new Set(this.plugin.settings.taskLists.map((taskList) => taskList.id));

    this.expandedTaskLists.clear();
    this.plugin.settings.expandedTaskListIds.forEach((id) => {
      if (taskListIds.has(id)) {
        this.expandedTaskLists.add(id);
      }
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
