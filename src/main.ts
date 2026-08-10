import {
  Notice,
  Plugin,
  TAbstractFile,
  TFile,
  WorkspaceLeaf,
  getLanguage,
} from "obsidian";

import {
  COMMAND_TOGGLE_CALENDAR,
  HOVER_LINK_SOURCE,
  RIBBON_ICON,
  VIEW_TYPE_CALENDAR,
  createDefaultSettings,
} from "./core/constants";
import { getTodayDateId } from "./core/dateUtils";
import strings, { formatLocalizedString, getLocales, setLocale } from "./core/localization";
import type { CalendarSettings, TaskList } from "./core/types";
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
import { CalendarNotesSettingTab } from "./settings";
import { CalendarView } from "./view/CalendarView";

const DATE_CHANGE_CHECK_MS = 60000;

function isTaskList(value: unknown): value is TaskList {
  if (!value || typeof value !== "object") {
    return false;
  }

  const taskList = value as Partial<TaskList>;
  const completionBehavior = taskList.completionBehavior;

  return typeof taskList.id === "string"
    && typeof taskList.name === "string"
    && typeof taskList.activeFolder === "string"
    && typeof taskList.newTaskName === "string"
    && typeof taskList.taskTemplate === "string"
    && Boolean(completionBehavior)
    && (
      completionBehavior?.type === "keep"
      || (
        completionBehavior?.type === "move"
        && typeof completionBehavior.completedFolder === "string"
      )
    );
}

function normalizeSettings(savedSettings: Partial<CalendarSettings>): CalendarSettings {
  const defaults = createDefaultSettings();
  const settings = Object.assign({}, defaults, savedSettings);

  if (!Array.isArray(settings.taskLists) || !settings.taskLists.every(isTaskList)) {
    settings.taskLists = defaults.taskLists;
  } else {
    settings.taskLists = settings.taskLists.map((taskList) => ({
      id: taskList.id,
      name: taskList.name,
      activeFolder: taskList.activeFolder,
      newTaskName: taskList.newTaskName,
      taskTemplate: taskList.taskTemplate,
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

export default class CalendarNotesPlugin extends Plugin {
  settings!: CalendarSettings;
  itemIndex!: ItemIndex;
  isMigrating = false;

  private currentDateId = getTodayDateId();
  private readonly reportedReconcileFailures = new Set<string>();
  private readonly pendingRepeatFiles = new Set<TFile>();
  private readonly taskCompletionQueues = new WeakMap<TFile, Promise<void>>();
  private settingsSaveQueue = Promise.resolve();

  async onload(): Promise<void> {
    setLocale([getLanguage(), ...getLocales()]);

    await this.loadSettings();

    this.itemIndex = new ItemIndex(this.app, () => this.settings);

    this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));

    this.registerHoverLinkSource(HOVER_LINK_SOURCE, {
      display: strings.calendarViewTitle,
      defaultMod: true,
    });

    this.addRibbonIcon(RIBBON_ICON, strings.calendarRibbonLabel, () => {
      void this.toggleView();
    });

    this.registerCommands();
    this.addSettingTab(new CalendarNotesSettingTab(this.app, this));

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
      id: COMMAND_TOGGLE_CALENDAR,
      name: strings.toggleCalendarCommandLabel,
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
        this.applyItemIndexChange(this.handleFileEvent(file, () => this.itemIndex.upsert(file)).changed);
      }),
    );

    this.registerEvent(
      vault.on("delete", (file: TAbstractFile) => {
        this.applyItemIndexChange(this.handleFileEvent(file, () => this.itemIndex.remove(file.path)).changed);
      }),
    );

    this.registerEvent(
      vault.on("rename", (file: TAbstractFile, oldPath: string) => {
        const result = this.handleFileEvent(file, () => this.itemIndex.rename(file, oldPath));

        this.applyItemIndexChange(result.changed);
        this.reconcile(file, "name");
      }),
    );

    this.registerEvent(
      metadataCache.on("changed", (file: TAbstractFile) => {
        const result = this.handleFileEvent(file, () => this.itemIndex.upsert(file));

        this.applyItemIndexChange(result.changed);
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
        console.error("Failed to synchronize calendar item name and date.", error);
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
    const savedSettings = ((await this.loadData()) ?? {}) as Partial<CalendarSettings>;

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

  private enqueueSettingsSave(action: () => Promise<void>): Promise<void> {
    const result = this.settingsSaveQueue.then(action);
    this.settingsSaveQueue = result.catch(() => undefined);

    return result;
  }

  async toggleView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);

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
    const existing = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);

    if (existing.length > 0) {
      await workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf: WorkspaceLeaf | null = workspace.getRightLeaf(false);

    if (!leaf) {
      return;
    }

    await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
    await workspace.revealLeaf(leaf);
  }

  private refreshViews(): void {
    this.forEachView((view) => view.render());
  }

  private forEachView(callback: (view: CalendarView) => void): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach((leaf) => {
      if (leaf.view instanceof CalendarView) {
        callback(leaf.view);
      }
    });
  }
}
