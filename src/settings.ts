import {
  App,
  ButtonComponent,
  Modal,
  Notice,
  PluginSettingTab,
  Setting,
  debounce,
} from "obsidian";

import { createDefaultSettings } from "./core/constants";
import {
  formatDateByPattern,
  getTodayDateId,
  isValidDateFormat,
  momentFormatToPattern,
  parseDateId,
  weekdayLongName,
} from "./core/dateUtils";
import strings, { formatLocalizedString } from "./core/localization";
import {
  buildAdditionalTaskListFolders,
  buildDefaultTemplatePath,
  suggestCompletedFolder,
} from "./core/pathDefaults";
import type { TaskList, WeekStart } from "./core/types";
import { applyDateFormatMigration, planDateFormatMigration } from "./data/dateFormatMigration";
import { normalizeFolderPath } from "./data/itemScopes";
import type CalendarNotesPlugin from "./main";
import { DateFormatMigrationModal } from "./view/DateFormatMigrationModal";
import { FolderSuggest } from "./view/FolderSuggest";
import { MarkdownFileSuggest } from "./view/MarkdownFileSuggest";

const REINDEX_DEBOUNCE_MS = 600;

function taskFolderNames() {
  return {
    taskLists: strings.taskListsFolderName,
    active: strings.activeTasksFolderName,
    completed: strings.completedTasksFolderName,
  };
}

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

export class CalendarNotesSettingTab extends PluginSettingTab {
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

  constructor(app: App, private plugin: CalendarNotesPlugin) {
    super(app, plugin);
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
        .onClick(() => this.addTaskList()));

    this.plugin.settings.taskLists.forEach((taskList, index) => {
      this.addTaskListSettings(containerEl, taskList, index);
    });

  }

  private addTaskList(): void {
    const id = crypto.randomUUID();
    const { folders, index } = this.nextTaskListDefaults();

    this.plugin.settings.taskLists.push({
      id,
      name: formatLocalizedString(strings.newTaskListName, { index: String(index) }),
      activeFolder: folders.activeFolder,
      newTaskName: strings.newTaskDefaultTitle,
      taskTemplate: "",
      completionBehavior: { type: "keep" },
    });
    void this.plugin.saveSettingsAndReindex().catch((error) => {
      new Notice(String(error instanceof Error ? error.message : error));
      this.display();
    });
    this.display();
  }

  private addTaskListSettings(
    containerEl: HTMLElement,
    taskList: TaskList,
    index: number,
  ): void {
    const group = containerEl.createDiv({ cls: "calendar-task-list-settings-group" });
    const heading = new Setting(group);
    heading.settingEl.addClass("calendar-task-list-settings-header");
    const nameFeedback = group.createDiv({ cls: "calendar-task-list-name-feedback" });

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
      text
        .setPlaceholder(strings.taskListNameLabel)
        .setValue(taskList.name)
        .onChange((value) => {
          taskList.name = value.trim();
          updateDuplicateNameWarning();
          this.saveAndReindex();
        });
      text.inputEl.setAttribute("aria-label", strings.taskListNameLabel);
      text.inputEl.addClass("calendar-task-list-name-input");
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

    const activeFolderSetting = new Setting(group)
      .setName(strings.taskListActiveFolderLabel)
      .setDesc(strings.taskListActiveFolderDescription)
      .addText((text) => {
        text.setValue(taskList.activeFolder).onChange((value) => {
          this.updateTaskListActiveFolder(taskList, value);
          this.saveAndReindex();
        });
        new FolderSuggest(this.app, text.inputEl).onSelect((folder) => {
          text.setValue(folder.path);
          this.updateTaskListActiveFolder(taskList, folder.path);
          this.saveAndReindex();
        });
      });
    activeFolderSetting.settingEl.addClass("calendar-task-list-setting");

    new Setting(group)
      .setName(strings.taskListCompletionLabel)
      .setDesc(strings.taskListCompletionDescription)
      .addDropdown((dropdown) => dropdown
        .addOption("keep", strings.taskListKeepLabel)
        .addOption("move", strings.taskListMoveLabel)
        .setValue(taskList.completionBehavior.type)
        .onChange((value) => {
          const folderNames = taskFolderNames();

          taskList.completionBehavior = value === "move"
            ? {
                type: "move",
                completedFolder: suggestCompletedFolder(
                  taskList.activeFolder,
                  folderNames.active,
                  folderNames.completed,
                ),
              }
            : { type: "keep" };
          this.saveAndReindex();
          this.display();
        }));

    if (taskList.completionBehavior.type === "move") {
      new Setting(group)
        .setName(strings.taskListCompletedFolderLabel)
        .setDesc(strings.taskListCompletedFolderDescription)
        .addText((text) => {
          text.setValue(taskList.completionBehavior.type === "move"
            ? taskList.completionBehavior.completedFolder
            : "");
          text.onChange((value) => {
            if (taskList.completionBehavior.type === "move") {
              taskList.completionBehavior.completedFolder = value.trim();
              this.saveAndReindex();
            }
          });
          new FolderSuggest(this.app, text.inputEl).onSelect((folder) => {
            text.setValue(folder.path);

            if (taskList.completionBehavior.type === "move") {
              taskList.completionBehavior.completedFolder = folder.path;
              this.saveAndReindex();
            }
          });
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

  private updateTaskListActiveFolder(taskList: TaskList, value: string): void {
    const activeFolder = value.trim();
    const folderNames = taskFolderNames();

    if (
      taskList.completionBehavior.type === "move"
      && taskList.completionBehavior.completedFolder
        === suggestCompletedFolder(
          taskList.activeFolder,
          folderNames.active,
          folderNames.completed,
        )
    ) {
      taskList.completionBehavior.completedFolder = suggestCompletedFolder(
        activeFolder,
        folderNames.active,
        folderNames.completed,
      );
    }

    taskList.activeFolder = activeFolder;
  }

  private nextTaskListDefaults(): {
    folders: ReturnType<typeof buildAdditionalTaskListFolders>;
    index: number;
  } {
    const configuredFolders = new Set(this.plugin.settings.taskLists.flatMap((taskList) => [
      taskList.activeFolder,
      ...(taskList.completionBehavior.type === "move"
        ? [taskList.completionBehavior.completedFolder]
        : []),
    ]).map(normalizeFolderPath));
    let index = 2;

    while (true) {
      const folderName = formatLocalizedString(strings.newTaskListFolderName, {
        index: String(index),
      });
      const folders = buildAdditionalTaskListFolders(folderName, taskFolderNames());

      if (
        !configuredFolders.has(normalizeFolderPath(folders.activeFolder))
        && !configuredFolders.has(normalizeFolderPath(folders.completedFolder))
      ) {
        return { folders, index };
      }

      index += 1;
    }
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

    setting.settingEl.addClass("calendar-notes-date-format-setting");

    const detailsEl = setting.settingEl.createDiv({ cls: "calendar-notes-format-details" });
    const feedbackEl = detailsEl.createDiv({ cls: "calendar-notes-format-preview" });

    detailsEl.createDiv({
      cls: "calendar-notes-format-warning",
      text: strings.dateFormatWarning,
    });

    let pendingFormat = this.plugin.settings.dateFormat;
    let applyButton: ButtonComponent | null = null;

    const updateFeedback = (format: string, valid: boolean): void => {
      feedbackEl.toggleClass("calendar-notes-format-error", !valid);
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

    setting.settingEl.addClass("calendar-notes-week-start-setting");
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

    new Setting(containerEl)
      .setName(options.name)
      .setDesc(options.description)
      .addText((text) => {
        text.setPlaceholder(fallback).setValue(this.plugin.settings[options.key]);

        new FolderSuggest(this.app, text.inputEl).onSelect((folder) => {
          text.setValue(folder.path);
          this.plugin.settings[options.key] = folder.path;
          this.saveAndReindex();
        });
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
