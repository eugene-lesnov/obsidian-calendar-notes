import {
  App,
  ButtonComponent,
  ColorComponent,
  Modal,
  Notice,
  PluginSettingTab,
  Setting,
  TFolder,
  TextComponent,
  debounce,
} from "obsidian";

import { DEFAULT_TASK_LIST_COLOR, createDefaultSettings } from "./core/constants";
import {
  formatDateByPattern,
  getTodayDateId,
  isValidDateFormat,
  momentFormatToPattern,
  parseDateId,
  weekdayLongName,
} from "./core/dateUtils";
import strings, { formatLocalizedString } from "./core/localization";
import { buildDefaultTemplatePath } from "./core/pathDefaults";
import type { TaskList, WeekStart } from "./core/types";
import { applyDateFormatMigration, planDateFormatMigration } from "./data/dateFormatMigration";
import { normalizeFolderPath, validateTaskLists } from "./data/itemScopes";
import type VaultAgendaPlugin from "./main";
import { DateFormatMigrationModal } from "./view/DateFormatMigrationModal";
import { FolderSuggest } from "./view/FolderSuggest";
import { MarkdownFileSuggest } from "./view/MarkdownFileSuggest";

const REINDEX_DEBOUNCE_MS = 600;
const FOLDER_BLUR_COMMIT_DELAY_MS = 150;
type TextSettingKey = "newNoteName";

type TemplateSettingKey = "noteTemplate";

type FolderSettingKey = "notesFolder";

class ConfirmTaskListDeleteModal extends Modal {
  constructor(app: App, private readonly onConfirm: () => void) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(strings.removeTaskListLabel);
    this.contentEl.createDiv({ text: strings.removeTaskListDescription });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });

    new ButtonComponent(actions)
      .setButtonText(strings.cancelLabel)
      .onClick(() => this.close());
    const removeButton = new ButtonComponent(actions)
      .setButtonText(strings.removeTaskListLabel)
      .onClick(() => {
        this.close();
        this.onConfirm();
      });
    removeButton.buttonEl.addClass("mod-warning");
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class VaultAgendaSettingTab extends PluginSettingTab {
  private readonly pendingMoveTaskListIds = new Set<string>();

  private readonly saveAndReindex = debounce(
    () => {
      void this.plugin.saveSettingsAndReindex().catch((error) => {
        new Notice(String(error instanceof Error ? error.message : error));
        this.display();
      });
    },
    REINDEX_DEBOUNCE_MS,
    true,
  );

  constructor(app: App, private plugin: VaultAgendaPlugin) {
    super(app, plugin);
  }

  hide(): void {
    this.pendingMoveTaskListIds.clear();
    super.hide();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.addDateFormatSetting(containerEl);
    this.addWeekStartSetting(containerEl);

    new Setting(containerEl).setName(strings.notesSectionLabel).setHeading();

    this.addFolderSetting(containerEl, {
      name: strings.notesFolderLabel,
      description: strings.notesFolderDescription,
      key: "notesFolder",
    });

    this.addTextSetting(containerEl, {
      name: strings.newNoteNameLabel,
      description: strings.newNoteNameDescription,
      placeholder: strings.newNoteDefaultTitle,
      key: "newNoteName",
    });

    this.addTemplateSetting(containerEl, {
      name: strings.noteTemplateLabel,
      description: strings.noteTemplateDescription,
      placeholder: buildDefaultTemplatePath(
        strings.templatesFolderName,
        strings.noteTemplateName,
      ),
      key: "noteTemplate",
    });

    new Setting(containerEl)
      .setName(strings.taskListsSectionLabel)
      .setHeading()
      .addButton((button) => button
        .setButtonText(strings.addTaskListLabel)
        .onClick(() => void this.addTaskList()));

    this.plugin.settings.taskLists.forEach((taskList, index) => {
      this.addTaskListSettings(containerEl, taskList, index);
    });

  }

  private async addTaskList(): Promise<void> {
    await this.plugin.promptTaskListSetup();
    this.display();
  }

  private addTaskListSettings(
    containerEl: HTMLElement,
    taskList: TaskList,
    index: number,
  ): void {
    const group = containerEl.createDiv({ cls: "vault-agenda-task-list-settings-group" });
    const heading = new Setting(group);
    heading.settingEl.addClass("vault-agenda-task-list-settings-header");
    const nameFeedback = group.createDiv({ cls: "vault-agenda-task-list-name-feedback" });

    const updateDuplicateNameWarning = (): void => {
      const normalizedName = taskList.name.trim().toLocaleLowerCase();
      const duplicateName = Boolean(normalizedName) && this.plugin.settings.taskLists.some((other) =>
        other.id !== taskList.id
        && other.name.trim().toLocaleLowerCase() === normalizedName,
      );

      nameFeedback.setText(duplicateName ? strings.taskListDuplicateNameWarning : "");
      nameFeedback.toggleClass("is-visible", duplicateName);
    };

    heading.addText((text) => {
      let committedName = taskList.name;

      text
        .setPlaceholder(strings.taskListNameLabel)
        .setValue(taskList.name)
        .onChange((value) => {
          const name = value.trim();

          if (!name) {
            nameFeedback.setText(strings.taskListNameRequiredError);
            nameFeedback.toggleClass("is-visible", true);
            return;
          }

          const candidate = { ...taskList, name };
          this.validateTaskListUpdate(taskList, candidate);
          taskList.name = name;
          committedName = name;
          updateDuplicateNameWarning();
          this.saveAndReindex();
        });
      text.inputEl.addEventListener("blur", () => {
        if (!text.inputEl.value.trim()) {
          text.setValue(committedName);
          updateDuplicateNameWarning();
        }
      });
      text.inputEl.setAttribute("aria-label", strings.taskListNameLabel);
      text.inputEl.addClass("vault-agenda-task-list-name-input");
    });
    heading.addExtraButton((button) => button
      .setIcon("arrow-up")
      .setDisabled(index === 0)
      .onClick(() => this.moveTaskList(index, -1)));
    heading.addExtraButton((button) => button
      .setIcon("arrow-down")
      .setDisabled(index === this.plugin.settings.taskLists.length - 1)
      .onClick(() => this.moveTaskList(index, 1)));
    heading.addExtraButton((button) => button
      .setIcon("trash-2")
      .setTooltip(strings.removeTaskListLabel)
      .onClick(() => this.confirmRemoveTaskList(index)));
    updateDuplicateNameWarning();

    this.addTaskListColorSetting(group, taskList);

    const activeFolderSetting = new Setting(group)
      .setName(strings.taskListActiveFolderLabel)
      .setDesc(strings.taskListActiveFolderDescription);
    this.addFolderInput(activeFolderSetting, {
      value: taskList.activeFolder,
      emptyError: formatLocalizedString(strings.taskListFolderRequiredError, {
        name: taskList.name,
      }),
      onCommit: (value) => this.commitActiveFolder(taskList, value),
    });
    activeFolderSetting.settingEl.addClass("vault-agenda-task-list-setting");

    const completionSetting = new Setting(group)
      .setName(strings.taskListCompletionLabel)
      .setDesc(strings.taskListCompletionDescription)
      .addDropdown((dropdown) => dropdown
        .addOption("keep", strings.taskListKeepLabel)
        .addOption("move", strings.taskListMoveLabel)
        .setValue(
          taskList.completionBehavior.type === "move"
            || this.pendingMoveTaskListIds.has(taskList.id)
            ? "move"
            : "keep",
        )
        .onChange((value) => {
          if (value === "move") {
            this.pendingMoveTaskListIds.add(taskList.id);
            this.display();
            return;
          }

          if (taskList.completionBehavior.type === "keep") {
            this.pendingMoveTaskListIds.delete(taskList.id);
            this.display();
            return;
          }

          const completionBehavior = { type: "keep" as const };
          try {
            this.validateTaskListUpdate(taskList, { ...taskList, completionBehavior });
          } catch (error) {
            new Notice(String(error instanceof Error ? error.message : error));
            this.display();
            return;
          }

          taskList.completionBehavior = completionBehavior;
          this.pendingMoveTaskListIds.delete(taskList.id);
          this.saveAndReindex();
          this.display();
        }));
    completionSetting.settingEl.addClass("vault-agenda-task-list-setting");

    if (
      taskList.completionBehavior.type === "move"
      || this.pendingMoveTaskListIds.has(taskList.id)
    ) {
      const completedFolderSetting = new Setting(group)
        .setName(strings.taskListCompletedFolderLabel)
        .setDesc(strings.taskListCompletedFolderDescription);
      this.addFolderInput(completedFolderSetting, {
        value: taskList.completionBehavior.type === "move"
          ? taskList.completionBehavior.completedFolder
          : "",
        placeholder: strings.taskListCompletedFolderLabel,
        focus: taskList.completionBehavior.type === "keep",
        emptyError: formatLocalizedString(strings.taskListFolderRequiredError, {
          name: taskList.name,
        }),
        onCommit: (value) => taskList.completionBehavior.type === "move"
          ? this.commitCompletedFolder(taskList, value)
          : this.enableMoveCompletion(taskList, value),
      });
    }

    new Setting(group)
      .setName(strings.newTaskNameLabel)
      .setDesc(strings.newTaskNameDescription)
      .addText((text) => text
        .setPlaceholder(strings.newTaskDefaultTitle)
        .setValue(taskList.newTaskName)
        .onChange((value) => {
          taskList.newTaskName = value.trim();
          void this.plugin.saveSettings();
        }));

    new Setting(group)
      .setName(strings.taskTemplateLabel)
      .setDesc(strings.taskTemplateDescription)
      .addText((text) => {
        text
          .setPlaceholder(buildDefaultTemplatePath(
            strings.templatesFolderName,
            strings.taskTemplateName,
          ))
          .setValue(taskList.taskTemplate)
          .onChange((value) => {
            taskList.taskTemplate = value.trim();
            void this.plugin.saveSettings();
          });

        new MarkdownFileSuggest(this.app, text.inputEl).onSelect((file) => {
          text.setValue(file.path);
          taskList.taskTemplate = file.path;
          void this.plugin.saveSettings();
        });
      });
  }

  private addTaskListColorSetting(group: HTMLElement, taskList: TaskList): void {
    let selectedColor = taskList.color ?? DEFAULT_TASK_LIST_COLOR;
    let colorPicker: ColorComponent;

    new Setting(group)
      .setName(strings.taskListColorLabel)
      .setDesc(strings.taskListColorDescription)
      .addToggle((toggle) => toggle
        .setValue(taskList.color !== null)
        .onChange((enabled) => {
          taskList.color = enabled ? selectedColor : null;
          colorPicker.setDisabled(!enabled);
          void this.plugin.saveSettings();
        }))
      .addColorPicker((picker) => {
        colorPicker = picker;
        picker
          .setValue(selectedColor)
          .setDisabled(taskList.color === null)
          .onChange((color) => {
            selectedColor = color;

            if (taskList.color !== null) {
              taskList.color = color;
              void this.plugin.saveSettings();
            }
          });
      });
  }

  private async commitActiveFolder(
    taskList: TaskList,
    activeFolder: string,
  ): Promise<void> {
    const candidate = { ...taskList, activeFolder };
    this.validateTaskListUpdate(taskList, candidate);
    taskList.activeFolder = activeFolder;
    await this.plugin.saveSettingsAndReindex();
  }

  private async enableMoveCompletion(taskList: TaskList, completedFolder: string): Promise<void> {
    const completionBehavior = { type: "move" as const, completedFolder };
    const candidate = { ...taskList, completionBehavior };
    this.validateTaskListUpdate(taskList, candidate);
    const previousCompletionBehavior = taskList.completionBehavior;
    taskList.completionBehavior = completionBehavior;

    try {
      await this.plugin.saveSettingsAndReindex();
      this.pendingMoveTaskListIds.delete(taskList.id);
    } catch (error) {
      taskList.completionBehavior = previousCompletionBehavior;
      throw error;
    }
  }

  private async commitCompletedFolder(taskList: TaskList, completedFolder: string): Promise<void> {
    if (taskList.completionBehavior.type !== "move") {
      return;
    }

    const completionBehavior = { type: "move" as const, completedFolder };
    const candidate = { ...taskList, completionBehavior };
    this.validateTaskListUpdate(taskList, candidate);
    taskList.completionBehavior = completionBehavior;
    await this.plugin.saveSettingsAndReindex();
  }

  private validateTaskListUpdate(taskList: TaskList, candidate: TaskList): void {
    validateTaskLists({
      ...this.plugin.settings,
      taskLists: this.plugin.settings.taskLists.map((current) =>
        current.id === taskList.id ? candidate : current,
      ),
    });
  }

  private moveTaskList(index: number, delta: number): void {
    const [taskList] = this.plugin.settings.taskLists.splice(index, 1);
    this.plugin.settings.taskLists.splice(index + delta, 0, taskList);
    void this.plugin.saveSettings();
    this.display();
  }

  private confirmRemoveTaskList(index: number): void {
    new ConfirmTaskListDeleteModal(this.app, () => {
      const [removed] = this.plugin.settings.taskLists.splice(index, 1);
      this.plugin.settings.expandedTaskListIds = this.plugin.settings.expandedTaskListIds
        .filter((id) => id !== removed.id);
      void this.plugin.saveSettingsAndReindex()
        .then(() => this.display())
        .catch((error) => {
          new Notice(String(error instanceof Error ? error.message : error));
          this.display();
        });
    }).open();
  }

  private addDateFormatSetting(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName(strings.dateFormatLabel)
      .setDesc(strings.dateFormatDescription);

    setting.settingEl.addClass("vault-agenda-date-format-setting");

    const detailsEl = setting.settingEl.createDiv({ cls: "vault-agenda-format-details" });
    const feedbackEl = detailsEl.createDiv({ cls: "vault-agenda-format-preview" });

    detailsEl.createDiv({
      cls: "vault-agenda-format-warning",
      text: strings.dateFormatWarning,
    });

    let pendingFormat = this.plugin.settings.dateFormat;
    let applyButton: ButtonComponent | null = null;

    const updateFeedback = (format: string, valid: boolean): void => {
      feedbackEl.toggleClass("vault-agenda-format-error", !valid);
      feedbackEl.setText(
        valid
          ? formatLocalizedString(strings.dateFormatPreview, { date: this.previewDate(format) })
          : strings.invalidDateFormatError,
      );
      applyButton?.setDisabled(!valid || format === this.plugin.settings.dateFormat);
    };

    setting.addText((text) =>
      text
        .setPlaceholder(this.plugin.settings.dateFormat)
        .setValue(this.plugin.settings.dateFormat)
        .onChange((value) => {
          pendingFormat = value.trim();
          updateFeedback(pendingFormat, isValidDateFormat(pendingFormat));
        }),
    );

    setting.addButton((button) => {
      applyButton = button;

      button
        .setButtonText(strings.dateFormatApplyLabel)
        .onClick(() => this.changeDateFormat(pendingFormat));
    });

    updateFeedback(this.plugin.settings.dateFormat, true);
  }

  private changeDateFormat(nextFormat: string): void {
    if (!isValidDateFormat(nextFormat) || nextFormat === this.plugin.settings.dateFormat) {
      return;
    }

    const plan = planDateFormatMigration(this.app, this.plugin.settings, nextFormat);

    const apply = (): void => {
      void this.applyDateFormat(nextFormat);
    };

    if (plan.entries.length === 0) {
      apply();

      return;
    }

    new DateFormatMigrationModal(
      this.app,
      plan,
      this.plugin.settings.dateFormat,
      nextFormat,
      apply,
    ).open();
  }

  private async applyDateFormat(nextFormat: string): Promise<void> {
    this.plugin.isMigrating = true;

    try {
      const plan = planDateFormatMigration(this.app, this.plugin.settings, nextFormat);
      const result = await applyDateFormatMigration(this.app, plan);

      this.plugin.settings.dateFormat = nextFormat;
      await this.plugin.saveSettingsAndReindex();

      new Notice(
        formatLocalizedString(strings.dateFormatMigrationDone, {
          items: String(result.migrated),
        }),
      );

      if (result.failures.length > 0) {
        new Notice(
          formatLocalizedString(strings.dateFormatMigrationFailed, {
            count: String(result.failures.length),
          }),
        );
      }
    } finally {
      await this.plugin.finishDateFormatMigration();
      this.display();
    }
  }

  private addWeekStartSetting(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName(strings.weekStartLabel)
      .addDropdown((dropdown) =>
        dropdown
          .addOption("monday", weekdayLongName("monday"))
          .addOption("sunday", weekdayLongName("sunday"))
          .setValue(this.plugin.settings.weekStart)
          .onChange(async (value) => {
            this.plugin.settings.weekStart = value as WeekStart;
            await this.plugin.saveSettings();
          }),
      );

    setting.settingEl.addClass("vault-agenda-week-start-setting");
  }

  private addFolderSetting(
    containerEl: HTMLElement,
    options: {
      name: string;
      description: string;
      key: FolderSettingKey;
    },
  ): void {
    const fallback = createDefaultSettings()[options.key];
    const setting = new Setting(containerEl)
      .setName(options.name)
      .setDesc(options.description);

    this.addFolderInput(setting, {
      value: this.plugin.settings[options.key],
      placeholder: fallback,
      emptyError: strings.notesFolderRequiredError,
      onCommit: async (value) => {
        this.plugin.settings[options.key] = value;
        await this.plugin.saveSettingsAndReindex();
      },
    });
  }

  private addFolderInput(
    setting: Setting,
    options: {
      value: string;
      placeholder?: string;
      focus?: boolean;
      emptyError: string;
      onCommit: (value: string) => Promise<void>;
    },
  ): void {
    const feedback = setting.descEl.createDiv({ cls: "vault-agenda-folder-feedback" });

    setting.addText((text: TextComponent) => {
      let committedValue = options.value;
      let blurTimer: number | null = null;
      let commitVersion = 0;

      const clearBlurTimer = (): void => {
        if (blurTimer !== null) {
          window.clearTimeout(blurTimer);
          blurTimer = null;
        }
      };

      const showFeedback = (message: string, type?: "error" | "warning"): void => {
        feedback.setText(message);
        feedback.toggleClass("is-visible", Boolean(message));
        feedback.toggleClass("is-error", type === "error");
        feedback.toggleClass("is-warning", type === "warning");
      };

      const showFolderStatus = (value: string): void => {
        const path = normalizeFolderPath(value);
        const exists = this.app.vault.getAbstractFileByPath(path) instanceof TFolder;

        showFeedback(exists ? "" : strings.folderMissingWarning, exists ? undefined : "warning");
      };

      const commit = async (rawValue: string): Promise<void> => {
        clearBlurTimer();
        const version = ++commitVersion;
        const trimmedValue = rawValue.trim();

        if (!trimmedValue) {
          showFeedback(options.emptyError, "error");
          return;
        }

        const value = normalizeFolderPath(trimmedValue);

        if (value === committedValue) {
          showFolderStatus(value);
          return;
        }

        try {
          await options.onCommit(value);

          if (version !== commitVersion) {
            return;
          }

          committedValue = value;
          text.setValue(value);
          showFolderStatus(value);
        } catch (error) {
          if (version === commitVersion) {
            showFeedback(String(error instanceof Error ? error.message : error), "error");
          }
        }
      };

      text.setValue(options.value);

      if (options.placeholder) {
        text.setPlaceholder(options.placeholder);
      }

      text.inputEl.addEventListener("input", () => {
        const value = text.inputEl.value.trim();
        showFeedback(value ? "" : options.emptyError, value ? undefined : "error");
      });
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commit(text.inputEl.value);
        } else if (event.key === "Escape") {
          event.preventDefault();
          ++commitVersion;
          clearBlurTimer();
          text.setValue(committedValue);
          showFolderStatus(committedValue);
          text.inputEl.blur();
        }
      });
      text.inputEl.addEventListener("blur", () => {
        if (!text.inputEl.value.trim()) {
          ++commitVersion;
          clearBlurTimer();

          if (committedValue) {
            text.setValue(committedValue);
            showFolderStatus(committedValue);
          } else {
            showFeedback(options.emptyError, "error");
          }

          return;
        }

        blurTimer = window.setTimeout(() => {
          blurTimer = null;
          void commit(text.inputEl.value);
        }, FOLDER_BLUR_COMMIT_DELAY_MS);
      });

      new FolderSuggest(this.app, text.inputEl).onSelect((folder) => {
        clearBlurTimer();
        text.setValue(folder.path);
        void commit(folder.path);
      });

      if (options.focus) {
        window.setTimeout(() => text.inputEl.focus());
      }

      if (options.value) {
        showFolderStatus(options.value);
      }
    });
  }

  private addTextSetting(
    containerEl: HTMLElement,
    options: {
      name: string;
      description: string;
      placeholder: string;
      key: TextSettingKey;
    },
  ): void {
    new Setting(containerEl)
      .setName(options.name)
      .setDesc(options.description)
      .addText((text) =>
        text
          .setPlaceholder(options.placeholder)
          .setValue(this.plugin.settings[options.key])
          .onChange(async (value) => {
            this.plugin.settings[options.key] = value.trim();
            await this.plugin.saveSettings();
          }),
      );
  }

  private addTemplateSetting(
    containerEl: HTMLElement,
    options: {
      name: string;
      description: string;
      placeholder: string;
      key: TemplateSettingKey;
    },
  ): void {
    new Setting(containerEl)
      .setName(options.name)
      .setDesc(options.description)
      .addText((text) => {
        text
          .setPlaceholder(options.placeholder)
          .setValue(this.plugin.settings[options.key])
          .onChange((value) => {
            this.plugin.settings[options.key] = value.trim();
            void this.plugin.saveSettings();
          });

        new MarkdownFileSuggest(this.app, text.inputEl).onSelect((file) => {
          text.setValue(file.path);
          this.plugin.settings[options.key] = file.path;
          void this.plugin.saveSettings();
        });
      });
  }

  private previewDate(format: string): string {
    const today = parseDateId(getTodayDateId());

    return formatDateByPattern(today, momentFormatToPattern(format));
  }
}
