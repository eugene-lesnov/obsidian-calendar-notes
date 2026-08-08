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
import type { CalendarSettings } from "./core/types";
import type { CalendarItem, CalendarItemKind } from "./data/calendarItem";
import { classifyFile } from "./data/calendarItem";
import type { CalendarUpsertResult } from "./data/calendarIndex";
import { CalendarIndex } from "./data/calendarIndex";
import { ensureFolder } from "./data/folders";
import { configuredFolderPaths, validateTaskFolders } from "./data/itemFolders";
import {
  completeRepeatingOccurrence,
  createItem,
  reconcileItemName,
} from "./data/itemMutations";
import type { ReconcileSource } from "./data/itemMutations";
import {
  isTaskStateTransitioning,
  synchronizeTaskState,
} from "./data/taskState";
import { CalendarNotesSettingTab } from "./settings";
import { CalendarView } from "./view/CalendarView";

const DATE_CHANGE_CHECK_MS = 60000;

export default class CalendarNotesPlugin extends Plugin {
  settings!: CalendarSettings;
  index!: CalendarIndex;
  isMigrating = false;

  private currentDateId = getTodayDateId();
  private readonly reportedReconcileFailures = new Set<string>();
  private readonly pendingRepeatFiles = new Set<TFile>();
  private readonly taskStateQueues = new WeakMap<TFile, Promise<void>>();

  async onload(): Promise<void> {
    setLocale([getLanguage(), ...getLocales()]);

    await this.loadSettings();

    this.index = new CalendarIndex(this.app, () => this.settings);

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
        validateTaskFolders(this.settings);
        await this.ensureConfiguredFolders();
        await this.organizeTasksByStatus();
      } catch (error) {
        console.error("Failed to prepare configured folders.", error);
        new Notice(String(error instanceof Error ? error.message : error));
      }

      this.index.rebuild();
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
  }

  private async createItemForToday(kind: CalendarItemKind): Promise<void> {
    try {
      const file = await createItem(this.app, this.settings, kind, getTodayDateId());

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
        this.applyIndexChange(this.handleFileEvent(file, () => this.index.upsert(file)).changed);
      }),
    );

    this.registerEvent(
      vault.on("delete", (file: TAbstractFile) => {
        this.applyIndexChange(this.handleFileEvent(file, () => this.index.remove(file.path)).changed);
      }),
    );

    this.registerEvent(
      vault.on("rename", (file: TAbstractFile, oldPath: string) => {
        const advanced = this.handleFileEvent(file, () => this.index.rename(file, oldPath));

        this.applyIndexChange(advanced.changed);
        this.reconcile(file, advanced.advancedRepeat, "name");
      }),
    );

    this.registerEvent(
      metadataCache.on("changed", (file: TAbstractFile) => {
        const advanced = this.handleFileEvent(file, () => this.index.upsert(file));

        this.applyIndexChange(advanced.changed);
        this.reconcile(file, advanced.advancedRepeat, "frontmatter");
      }),
    );
  }

  private handleFileEvent(
    file: TAbstractFile,
    action: () => CalendarUpsertResult,
  ): { changed: boolean; advancedRepeat: boolean } {
    if (!(file instanceof TFile)) {
      return { changed: false, advancedRepeat: false };
    }

    const result = action();

    const { previous, current } = result;
    const completedTask = previous?.kind === "task"
      && current?.kind === "task"
      && !previous.done
      && current.done
      ? current
      : null;

    if (completedTask?.repeat) {
      if (this.isMigrating) {
        this.pendingRepeatFiles.add(file);

        return { changed: result.changed, advancedRepeat: false };
      }

      this.enqueueTaskStateUpdate(completedTask.file, true);

      return { changed: result.changed, advancedRepeat: true };
    }

    if (
      current?.kind === "task"
      && !isTaskStateTransitioning(current.file)
    ) {
      this.enqueueTaskStateUpdate(current.file, false);
    }

    return { changed: result.changed, advancedRepeat: false };
  }

  private enqueueTaskStateUpdate(file: TFile, advanceRepeat: boolean): void {
    const queue = this.taskStateQueues.get(file) ?? Promise.resolve();
    const next = queue
      .then(async () => {
        const current = classifyFile(this.app, file, this.settings);

        if (current?.kind !== "task") {
          return;
        }

        await synchronizeTaskState(this.app, this.settings, current);

        if (advanceRepeat) {
          const latest = classifyFile(this.app, file, this.settings);

          if (latest?.kind === "task" && latest.done && latest.repeat) {
            await this.advanceRepeatingTask(latest);
          }
        }
      })
      .catch((error) => {
        console.error("Failed to apply task status change.", error);
        new Notice(String(error instanceof Error ? error.message : error));
      });

    this.taskStateQueues.set(file, next);
  }

  private reconcile(file: TAbstractFile, advancedRepeat: boolean, source: ReconcileSource): void {
    if (advancedRepeat || this.isMigrating || !(file instanceof TFile)) {
      return;
    }

    const path = file.path;

    void reconcileItemName(this.app, this.settings, file, source)
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

  private async advanceRepeatingTask(item: CalendarItem): Promise<void> {
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
      const item = classifyFile(this.app, file, this.settings);

      if (item?.kind === "task" && item.done && item.repeat) {
        await this.advanceRepeatingTask(item);
      }
    }
  }

  private applyIndexChange(changed: boolean): void {
    if (!changed) {
      return;
    }

    this.forEachView((view) => view.scheduleRender());
  }

  async loadSettings(): Promise<void> {
    const savedSettings = ((await this.loadData()) ?? {}) as Partial<CalendarSettings>;

    this.settings = Object.assign({}, createDefaultSettings(), savedSettings);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.refreshViews();
  }

  async saveSettingsAndReindex(): Promise<void> {
    const savedSettings = Object.assign(
      {},
      createDefaultSettings(),
      ((await this.loadData()) ?? {}) as Partial<CalendarSettings>,
    );

    try {
      validateTaskFolders(this.settings);
      await this.ensureConfiguredFolders();
      await this.saveData(this.settings);
      this.index.rebuild();
      this.refreshViews();
    } catch (error) {
      this.settings = savedSettings;
      this.index.rebuild();
      this.refreshViews();
      throw error;
    }
  }

  private async ensureConfiguredFolders(): Promise<void> {
    for (const path of configuredFolderPaths(this.settings)) {
      await ensureFolder(this.app, path);
    }
  }

  private async organizeTasksByStatus(): Promise<void> {
    for (const file of this.app.vault.getMarkdownFiles()) {
      const item = classifyFile(this.app, file, this.settings);

      if (item?.kind === "task") {
        await synchronizeTaskState(this.app, this.settings, item);
      }
    }
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
