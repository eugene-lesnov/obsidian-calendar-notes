import { App, ButtonComponent, Notice, PluginSettingTab, Setting, debounce } from "obsidian";

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
import type { WeekStart } from "./core/types";
import { applyDateFormatMigration, planDateFormatMigration } from "./data/dateFormatMigration";
import type CalendarNotesPlugin from "./main";
import { DateFormatMigrationModal } from "./view/DateFormatMigrationModal";
import { FolderSuggest } from "./view/FolderSuggest";
import { MarkdownFileSuggest } from "./view/MarkdownFileSuggest";

const REINDEX_DEBOUNCE_MS = 600;

type TextSettingKey = "newNoteName" | "newTaskName";

type TemplateSettingKey = "noteTemplate" | "taskTemplate";

type FolderSettingKey = "notesFolder" | "activeTasksFolder" | "completedTasksFolder";

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
      placeholder: strings.noteTemplatePlaceholder,
      key: "noteTemplate",
    });

    new Setting(containerEl).setName(strings.tasksSectionLabel).setHeading();

    this.addFolderSetting(containerEl, {
      name: strings.activeTasksFolderLabel,
      description: strings.activeTasksFolderDescription,
      key: "activeTasksFolder",
    });

    this.addFolderSetting(containerEl, {
      name: strings.completedTasksFolderLabel,
      description: strings.completedTasksFolderDescription,
      key: "completedTasksFolder",
    });

    this.addTextSetting(containerEl, {
      name: strings.newTaskNameLabel,
      description: strings.newTaskNameDescription,
      placeholder: strings.newTaskDefaultTitle,
      key: "newTaskName",
    });

    this.addTemplateSetting(containerEl, {
      name: strings.taskTemplateLabel,
      description: strings.taskTemplateDescription,
      placeholder: strings.taskTemplatePlaceholder,
      key: "taskTemplate",
    });
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
        text.setPlaceholder(options.placeholder).setValue(this.plugin.settings[options.key]);

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
