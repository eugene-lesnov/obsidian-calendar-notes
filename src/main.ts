import {
  Notice,
  Plugin,
  TAbstractFile,
  TFile,
  WorkspaceLeaf,
  getLanguage,
} from "obsidian";

import {
  COMMAND_TOGGLE_AGENDA,
  HOVER_LINK_SOURCE,
  RIBBON_ICON,
  VIEW_TYPE_AGENDA,
  createDefaultSettings,
} from "./core/constants";
import { getTodayDateId } from "./core/dateUtils";
import strings, { formatLocalizedString, getLocales, setLocale } from "./core/localization";
import type {
  NewTaskListConfig,
  VaultAgendaSettings,
  TaskList,
  TaskOrder,
} from "./core/types";
import type { ItemKind, Task } from "./data/item";
import { classifyItemFile } from "./data/item";
import type { ItemUpsertResult } from "./data/itemIndex";
import { ItemIndex } from "./data/itemIndex";
import { validateTaskLists } from "./data/itemScopes";
import {
  completeRepeatingOccurrence,
  createDatedItem,
  reconcileItemName,
} from "./data/itemMutations";
import type { ReconcileTrigger } from "./data/itemMutations";
import {
  applyExternalTaskCompletion,
  isTaskCompletionTransitioning,
  setTaskCompleted,
} from "./data/taskCompletion";
import { VaultAgendaSettingTab } from "./settings";
import { AgendaView } from "./view/AgendaView";
import { TaskListSetupModal } from "./view/TaskListSetupModal";

const DATE_CHANGE_CHECK_MS = 60000;
const TASK_ORDERS: readonly TaskOrder[] = [
  "title-asc",
  "title-desc",
  "date-asc",
  "date-desc",
  "manual",
];

function isTaskList(value: unknown): value is TaskList {
  if (!value || typeof value !== "object") {
    return false;
  }

  const taskList = value as Partial<TaskList>;
  const completionBehavior = taskList.completionBehavior;

  return typeof taskList.id === "string"
    && typeof taskList.name === "string"
    && (
      taskList.color === undefined
      || taskList.color === null
      || typeof taskList.color === "string"
    )
    && typeof taskList.activeFolder === "string"
    && typeof taskList.newTaskName === "string"
    && typeof taskList.taskTemplate === "string"
    && typeof taskList.order === "string"
    && TASK_ORDERS.includes(taskList.order)
    && Array.isArray(taskList.manualOrder)
    && taskList.manualOrder.every((path) => typeof path === "string")
    && Boolean(completionBehavior)
    && (
      completionBehavior?.type === "keep"
      || (
        completionBehavior?.type === "move"
        && typeof completionBehavior.completedFolder === "string"
      )
    );
}

function normalizeSettings(savedSettings: Partial<VaultAgendaSettings>): VaultAgendaSettings {
  const defaults = createDefaultSettings();
  const settings = Object.assign({}, defaults, savedSettings);

  if (!Array.isArray(settings.taskLists) || !settings.taskLists.every(isTaskList)) {
    settings.taskLists = defaults.taskLists;
  } else {
    settings.taskLists = settings.taskLists.map((taskList) => ({
      id: taskList.id,
      name: taskList.name,
      color: typeof taskList.color === "string" && /^#[0-9a-f]{6}$/i.test(taskList.color)
        ? taskList.color
        : null,
      activeFolder: taskList.activeFolder,
      newTaskName: taskList.newTaskName,
      taskTemplate: taskList.taskTemplate,
      order: taskList.order,
      manualOrder: [...taskList.manualOrder],
      completionBehavior: taskList.completionBehavior.type === "move"
        ? {
            type: "move",
            completedFolder: taskList.completionBehavior.completedFolder,
          }
        : { type: "keep" },
    }));
  }

  if (!Array.isArray(settings.expandedTaskListIds)) {
    settings.expandedTaskListIds = defaults.expandedTaskListIds;
  } else {
    settings.expandedTaskListIds = [...settings.expandedTaskListIds];
  }

  return settings;
}

export default class VaultAgendaPlugin extends Plugin {
  settings!: VaultAgendaSettings;
  itemIndex!: ItemIndex;
  isMigrating = false;

  private currentDateId = getTodayDateId();
  private readonly reportedReconcileFailures = new Set<string>();
  private readonly pendingRepeatFiles = new Set<TFile>();
  private readonly taskCompletionQueues = new WeakMap<TFile, Promise<void>>();
  private settingsSaveQueue = Promise.resolve();
  private taskListSetupPromise: Promise<TaskList | null> | null = null;

  async onload(): Promise<void> {
    setLocale([getLanguage(), ...getLocales()]);

    await this.loadSettings();

    this.itemIndex = new ItemIndex(this.app, () => this.settings);

    this.registerView(VIEW_TYPE_AGENDA, (leaf) => new AgendaView(leaf, this));

    this.registerHoverLinkSource(HOVER_LINK_SOURCE, {
      display: strings.agendaViewTitle,
      defaultMod: true,
    });

    this.addRibbonIcon(RIBBON_ICON, strings.agendaRibbonLabel, () => {
      void this.toggleView();
    });

    this.registerCommands();
    this.addSettingTab(new VaultAgendaSettingTab(this.app, this));

    this.registerInterval(
      window.setInterval(() => this.checkDateChange(), DATE_CHANGE_CHECK_MS),
    );

    this.app.workspace.onLayoutReady(async () => {
      try {
        validateTaskLists(this.settings);
      } catch (error) {
        console.error("Failed to prepare configured folders.", error);
        new Notice(String(error instanceof Error ? error.message : error));
      }

      this.itemIndex.rebuild();
      this.registerVaultEvents();
      this.refreshViews();
    });
  }

  private registerCommands(): void {
    this.addCommand({
      id: COMMAND_TOGGLE_AGENDA,
      name: strings.toggleAgendaCommandLabel,
      callback: () => {
        void this.toggleView();
      },
    });

    this.addCommand({
      id: "create-note-today",
      name: strings.createNoteTodayCommandLabel,
      callback: () => {
        void this.createItemForToday("note");
      },
    });

    this.addCommand({
      id: "create-task-today",
      name: strings.createTaskTodayCommandLabel,
      callback: () => {
        void this.createItemForToday("task");
      },
    });

    this.addCommand({
      id: "go-to-today",
      name: strings.goToTodayCommandLabel,
      callback: () => {
        void this.goToToday();
      },
    });

    this.addCommand({
      id: "reopen-current-task",
      name: strings.reopenCurrentTaskCommandLabel,
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const item = file ? classifyItemFile(this.app, file, this.settings) : null;
        const available = item?.kind === "task" && item.done;

        if (available && !checking) {
          void setTaskCompleted(this.app, this.settings, item, false).catch((error) => {
            new Notice(String(error instanceof Error ? error.message : error));
          });
        }

        return available;
      },
    });
  }

  private async createItemForToday(kind: ItemKind): Promise<void> {
    try {
      if (kind === "task" && this.settings.taskLists.length === 0) {
        const taskList = await this.promptTaskListSetup(strings.setupAndCreateTaskLabel);

        if (!taskList) {
          return;
        }
      }

      const file = await createDatedItem(this.app, this.settings, kind, getTodayDateId());

      await this.app.workspace.getLeaf(false).openFile(file);
    } catch (error) {
      new Notice(String(error instanceof Error ? error.message : error));
    }
  }

  private async goToToday(): Promise<void> {
    await this.activateView();

    this.forEachView((view) => view.selectDay(getTodayDateId()));
  }

  private checkDateChange(): void {
    const todayDateId = getTodayDateId();

    if (todayDateId === this.currentDateId) {
      return;
    }

    this.currentDateId = todayDateId;
    this.forEachView((view) => view.scheduleRender());
  }

  private registerVaultEvents(): void {
    const { metadataCache, vault } = this.app;

    this.registerEvent(
      vault.on("create", (file: TAbstractFile) => {
        const result = this.handleFileEvent(file, () => this.itemIndex.upsert(file));

        this.applyItemIndexChange(result.changed);
        this.syncManualOrder(result);
      }),
    );

    this.registerEvent(
      vault.on("delete", (file: TAbstractFile) => {
        const result = this.handleFileEvent(file, () => this.itemIndex.remove(file.path));

        this.applyItemIndexChange(result.changed);
        this.syncManualOrder(result);
      }),
    );

    this.registerEvent(
      vault.on("rename", (file: TAbstractFile, oldPath: string) => {
        const result = this.handleFileEvent(file, () => this.itemIndex.rename(file, oldPath));

        this.applyItemIndexChange(result.changed);
        this.syncManualOrder(result, oldPath);
        this.reconcile(file, "name");
      }),
    );

    this.registerEvent(
      metadataCache.on("changed", (file: TAbstractFile) => {
        const result = this.handleFileEvent(file, () => this.itemIndex.upsert(file));

        this.applyItemIndexChange(result.changed);
        this.syncManualOrder(result);
        this.reconcile(file, "frontmatter");
      }),
    );
  }

  private handleFileEvent(
    file: TAbstractFile,
    action: () => ItemUpsertResult,
  ): ItemUpsertResult {
    if (!(file instanceof TFile)) {
      return { changed: false, previous: null, current: null };
    }

    const result = action();

    const { previous, current } = result;
    if (
      previous?.kind === "task"
      && current?.kind === "task"
      && previous.done !== current.done
    ) {
      const pluginTransition = isTaskCompletionTransitioning(current.file);
      const advanceRepeat = current.done && Boolean(current.repeat);

      if (this.isMigrating && advanceRepeat) {
        this.pendingRepeatFiles.add(file);
      } else {
        this.enqueueTaskCompletionUpdate(previous, current, !pluginTransition, advanceRepeat);
      }
    }

    return result;
  }

  private syncManualOrder(
    result: ItemUpsertResult,
    previousPath = result.previous?.file.path ?? null,
  ): void {
    const { previous, current } = result;
    let changed = false;

    if (previous?.kind === "task" && previousPath) {
      const previousList = this.settings.taskLists.find((list) => list.id === previous.taskListId);
      const previousIndex = previousList?.manualOrder.indexOf(previousPath) ?? -1;

      if (previousList && previousIndex >= 0) {
        if (current?.kind === "task" && current.taskListId === previous.taskListId) {
          if (previousPath !== current.file.path) {
            if (previousList.manualOrder.includes(current.file.path)) {
              previousList.manualOrder.splice(previousIndex, 1);
            } else {
              previousList.manualOrder[previousIndex] = current.file.path;
            }
            changed = true;
          }
        } else {
          previousList.manualOrder.splice(previousIndex, 1);
          changed = true;
        }
      }
    }

    if (current?.kind === "task" && current.taskLocation === "active") {
      const currentList = this.settings.taskLists.find((list) => list.id === current.taskListId);
      const tracksManualOrder = currentList
        && (currentList.order === "manual" || currentList.manualOrder.length > 0);

      if (tracksManualOrder && !currentList.manualOrder.includes(current.file.path)) {
        currentList.manualOrder.push(current.file.path);
        changed = true;
      }
    }

    if (changed) {
      this.saveManualOrder();
    }
  }

  private saveManualOrder(): void {
    void this.saveSettings().catch((error) => {
      console.error("Failed to update manual task order.", error);
      new Notice(String(error instanceof Error ? error.message : error));
    });
  }

  private enqueueTaskCompletionUpdate(
    previous: Task,
    current: Task,
    synchronizeExternal: boolean,
    advanceRepeat: boolean,
  ): void {
    const queue = this.taskCompletionQueues.get(current.file) ?? Promise.resolve();
    const next = queue
      .then(async () => {
        if (synchronizeExternal) {
          await applyExternalTaskCompletion(this.app, this.settings, previous, current);
        }

        if (advanceRepeat) {
          const latest = classifyItemFile(this.app, current.file, this.settings);

          if (latest?.kind === "task" && latest.done && latest.repeat) {
            await this.advanceRepeatingTask(latest);
          }
        }
      })
      .catch((error) => {
        console.error("Failed to apply task status change.", error);
        new Notice(String(error instanceof Error ? error.message : error));
      });

    this.taskCompletionQueues.set(current.file, next);
  }

  private reconcile(file: TAbstractFile, trigger: ReconcileTrigger): void {
    if (this.isMigrating || !(file instanceof TFile)) {
      return;
    }

    const path = file.path;

    void reconcileItemName(this.app, this.settings, file, trigger)
      .then(() => this.reportedReconcileFailures.delete(path))
      .catch((error) => {
        console.error("Failed to synchronize Vault Agenda item name and date.", error);
        this.notifyReconcileFailure(path);
      });
  }

  private notifyReconcileFailure(path: string): void {
    if (this.reportedReconcileFailures.has(path)) {
      return;
    }

    this.reportedReconcileFailures.add(path);
    new Notice(formatLocalizedString(strings.reconcileError, { path }));
  }

  private async advanceRepeatingTask(item: Task): Promise<void> {
    try {
      await completeRepeatingOccurrence(this.app, this.settings, item);
    } catch (error) {
      console.error("Failed to move the repeating task to its next date.", error);
      new Notice(strings.repeatAdvanceError);
    }
  }

  async finishDateFormatMigration(): Promise<void> {
    this.isMigrating = false;

    const pendingFiles = Array.from(this.pendingRepeatFiles);
    this.pendingRepeatFiles.clear();

    for (const file of pendingFiles) {
      const item = classifyItemFile(this.app, file, this.settings);

      if (item?.kind === "task" && item.done && item.repeat) {
        await this.advanceRepeatingTask(item);
      }
    }
  }

  private applyItemIndexChange(changed: boolean): void {
    if (!changed) {
      return;
    }

    this.forEachView((view) => view.scheduleRender());
  }

  async loadSettings(): Promise<void> {
    const savedSettings = ((await this.loadData()) ?? {}) as Partial<VaultAgendaSettings>;

    this.settings = normalizeSettings(savedSettings);
  }

  async saveSettings(): Promise<void> {
    const settings = normalizeSettings(this.settings);

    await this.enqueueSettingsSave(async () => {
      await this.saveData(settings);
      this.refreshViews();
    });
  }

  async saveSettingsAndReindex(): Promise<void> {
    const settings = normalizeSettings(this.settings);
    validateTaskLists(settings);

    await this.enqueueSettingsSave(async () => {
      await this.saveData(settings);
      this.itemIndex.rebuild();
      this.refreshViews();
    });
  }

  promptTaskListSetup(submitLabel = strings.addTaskListLabel): Promise<TaskList | null> {
    if (this.taskListSetupPromise) {
      return this.taskListSetupPromise;
    }

    this.taskListSetupPromise = new Promise<TaskList | null>((resolve) => {
      new TaskListSetupModal(
        this.app,
        this.newTaskListDefaults(),
        submitLabel,
        (config) => this.createTaskList(config),
        resolve,
      ).open();
    }).finally(() => {
      this.taskListSetupPromise = null;
    });

    return this.taskListSetupPromise;
  }

  private newTaskListDefaults(): NewTaskListConfig {
    const configuredNames = new Set(this.settings.taskLists.map((taskList) =>
      taskList.name.trim().toLocaleLowerCase()));
    let index = Math.max(2, this.settings.taskLists.length + 1);
    let name = this.settings.taskLists.length === 0
      ? strings.tasksSectionLabel
      : formatLocalizedString(strings.newTaskListName, { index: String(index) });

    while (configuredNames.has(name.toLocaleLowerCase())) {
      index += 1;
      name = formatLocalizedString(strings.newTaskListName, { index: String(index) });
    }

    return {
      name,
      color: null,
      activeFolder: "",
      newTaskName: strings.newTaskDefaultTitle,
      taskTemplate: "",
      order: "title-asc",
      completionBehavior: { type: "keep" },
    };
  }

  private async createTaskList(config: NewTaskListConfig): Promise<TaskList> {
    const taskList: TaskList = {
      id: crypto.randomUUID(),
      ...config,
      manualOrder: [],
    };
    const candidate = {
      ...this.settings,
      taskLists: [...this.settings.taskLists, taskList],
      expandedTaskListIds: [...this.settings.expandedTaskListIds, taskList.id],
    };
    validateTaskLists(candidate);
    this.settings.taskLists.push(taskList);
    this.settings.expandedTaskListIds.push(taskList.id);

    try {
      await this.saveSettingsAndReindex();
      return taskList;
    } catch (error) {
      this.settings.taskLists = this.settings.taskLists.filter((current) => current.id !== taskList.id);
      this.settings.expandedTaskListIds = this.settings.expandedTaskListIds.filter(
        (id) => id !== taskList.id,
      );
      throw error;
    }
  }

  private enqueueSettingsSave(action: () => Promise<void>): Promise<void> {
    const result = this.settingsSaveQueue.then(action);
    this.settingsSaveQueue = result.catch(() => undefined);

    return result;
  }

  async toggleView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENDA);

    if (leaves.length === 0) {
      await this.activateView();
      return;
    }

    const visible = leaves.find((leaf) => leaf.view.containerEl.isShown());

    if (visible) {
      leaves.forEach((leaf) => leaf.detach());
      return;
    }

    await this.app.workspace.revealLeaf(leaves[0]);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_AGENDA);

    if (existing.length > 0) {
      await workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf: WorkspaceLeaf | null = workspace.getRightLeaf(false);

    if (!leaf) {
      return;
    }

    await leaf.setViewState({ type: VIEW_TYPE_AGENDA, active: true });
    await workspace.revealLeaf(leaf);
  }

  private refreshViews(): void {
    this.forEachView((view) => view.render());
  }

  private forEachView(callback: (view: AgendaView) => void): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENDA).forEach((leaf) => {
      if (leaf.view instanceof AgendaView) {
        callback(leaf.view);
      }
    });
  }
}
