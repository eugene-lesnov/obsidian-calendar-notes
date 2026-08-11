import { App, ColorComponent, Modal, Setting, TFolder } from "obsidian";

import { DEFAULT_TASK_LIST_COLOR } from "../core/constants";
import strings, { formatLocalizedString } from "../core/localization";
import { buildDefaultTemplatePath } from "../core/pathDefaults";
import type {
  CompletionBehavior,
  NewTaskListConfig,
  TaskList,
  TaskListColor,
  TaskOrder,
} from "../core/types";
import { normalizeFolderPath } from "../data/itemScopes";
import { FolderSuggest } from "./FolderSuggest";
import { MarkdownFileSuggest } from "./MarkdownFileSuggest";

export class TaskListSetupModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly initialConfig: NewTaskListConfig,
    private readonly submitLabel: string,
    private readonly onSubmit: (config: NewTaskListConfig) => Promise<TaskList>,
    private readonly onResult: (taskList: TaskList | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(strings.taskListSetupTitle);
    this.contentEl.createDiv({ text: strings.taskListSetupDescription });

    let name = this.initialConfig.name;
    let color = this.initialConfig.color;
    let activeFolder = this.initialConfig.activeFolder;
    let completionBehavior = this.initialConfig.completionBehavior;
    let completedFolderDraft = completionBehavior.type === "move"
      ? completionBehavior.completedFolder
      : "";
    let newTaskName = this.initialConfig.newTaskName;
    let taskTemplate = this.initialConfig.taskTemplate;
    let order = this.initialConfig.order;

    new Setting(this.contentEl)
      .setName(strings.taskListNameLabel)
      .setDesc(strings.taskListNameDescription)
      .addText((text) => text
        .setValue(name)
        .onChange((value) => {
          name = value;
        }));

    this.addFolderSetting(
      this.contentEl,
      strings.taskListActiveFolderLabel,
      strings.taskListSetupFolderDescription,
      activeFolder,
      (value) => {
        activeFolder = value;
      },
      true,
    );

    let completedFolderContainer: HTMLDivElement;
    const renderCompletedFolder = (): void => {
      completedFolderContainer.empty();

      if (completionBehavior.type !== "move") {
        return;
      }

      this.addFolderSetting(
        completedFolderContainer,
        strings.taskListCompletedFolderLabel,
        strings.taskListCompletedFolderDescription,
        completionBehavior.completedFolder,
        (completedFolder) => {
          completedFolderDraft = completedFolder;
          completionBehavior = { type: "move", completedFolder };
        },
        true,
      );
    };

    new Setting(this.contentEl)
      .setName(strings.taskListCompletionLabel)
      .setDesc(strings.taskListCompletionDescription)
      .addDropdown((dropdown) => dropdown
        .addOption("keep", strings.taskListKeepLabel)
        .addOption("move", strings.taskListMoveLabel)
        .setValue(completionBehavior.type)
        .onChange((value) => {
          completionBehavior = value === "move"
            ? { type: "move", completedFolder: completedFolderDraft }
            : { type: "keep" };
          renderCompletedFolder();
        }));
    completedFolderContainer = this.contentEl.createDiv();
    renderCompletedFolder();

    const details = this.contentEl.createEl("details", {
      cls: "vault-agenda-task-list-setup-details",
    });
    details.createEl("summary", { text: strings.taskListSetupAdvancedLabel });

    let selectedColor = color ?? DEFAULT_TASK_LIST_COLOR;
    let colorPicker: ColorComponent;
    new Setting(details)
      .setName(strings.taskListColorLabel)
      .setDesc(strings.taskListColorDescription)
      .addToggle((toggle) => toggle
        .setValue(color !== null)
        .onChange((enabled) => {
          color = enabled ? selectedColor : null;
          colorPicker.setDisabled(!enabled);
        }))
      .addColorPicker((picker) => {
        colorPicker = picker;
        picker
          .setValue(selectedColor)
          .setDisabled(color === null)
          .onChange((value) => {
            selectedColor = value;

            if (color !== null) {
              color = value;
            }
          });
      });

    new Setting(details)
      .setName(strings.newTaskNameLabel)
      .setDesc(strings.newTaskNameDescription)
      .addText((text) => text
        .setValue(newTaskName)
        .setPlaceholder(strings.newTaskDefaultTitle)
        .onChange((value) => {
          newTaskName = value;
        }));

    new Setting(details)
      .setName(strings.taskTemplateLabel)
      .setDesc(strings.taskTemplateDescription)
      .addText((text) => {
        text.setValue(taskTemplate);
        text.setPlaceholder(buildDefaultTemplatePath(
          strings.templatesFolderName,
          strings.taskTemplateName,
        ));
        text.onChange((value) => {
          taskTemplate = value;
        });

        new MarkdownFileSuggest(this.app, text.inputEl).onSelect((file) => {
          taskTemplate = file.path;
          text.setValue(file.path);
        });
      });

    new Setting(details)
      .setName(strings.taskOrderLabel)
      .addDropdown((dropdown) => dropdown
        .addOption("title-asc", strings.taskOrderTitleAscLabel)
        .addOption("title-desc", strings.taskOrderTitleDescLabel)
        .addOption("date-asc", strings.taskOrderDateAscLabel)
        .addOption("date-desc", strings.taskOrderDateDescLabel)
        .addOption("manual", strings.taskOrderManualLabel)
        .setValue(order)
        .onChange((value) => {
          order = value as TaskOrder;
        }));

    const feedback = this.contentEl.createDiv({ cls: "vault-agenda-folder-feedback" });
    let submitting = false;
    const submit = async (): Promise<void> => {
      if (submitting) {
        return;
      }

      const config = this.buildConfig({
        name,
        color,
        activeFolder,
        completionBehavior,
        newTaskName,
        taskTemplate,
        order,
      });

      if (!config.name) {
        this.showError(feedback, strings.taskListNameRequiredError);
        return;
      }

      if (
        !config.activeFolder
        || (config.completionBehavior.type === "move"
          && !config.completionBehavior.completedFolder)
      ) {
        this.showError(feedback, formatLocalizedString(strings.taskListFolderRequiredError, {
          name: config.name,
        }));
        return;
      }

      try {
        submitting = true;
        const taskList = await this.onSubmit(config);
        this.settled = true;
        this.onResult(taskList);
        this.close();
      } catch (error) {
        submitting = false;
        this.showError(feedback, String(error instanceof Error ? error.message : error));
      }
    };

    new Setting(this.contentEl)
      .addButton((button) => button
        .setButtonText(strings.cancelLabel)
        .onClick(() => this.close()))
      .addButton((button) => button
        .setButtonText(this.submitLabel)
        .setCta()
        .onClick(() => void submit()));
  }

  onClose(): void {
    this.contentEl.empty();

    if (!this.settled) {
      this.settled = true;
      this.onResult(null);
    }
  }

  private addFolderSetting(
    container: HTMLElement,
    name: string,
    description: string,
    initialValue: string,
    onChange: (value: string) => void,
    focus = false,
  ): void {
    const setting = new Setting(container).setName(name).setDesc(description);
    const feedback = setting.descEl.createDiv({ cls: "vault-agenda-folder-feedback" });

    const showStatus = (value: string): void => {
      const path = normalizeFolderPath(value.trim());

      if (!value.trim()) {
        feedback.setText("");
        feedback.removeClass("is-visible", "is-warning");
        return;
      }

      const exists = this.app.vault.getAbstractFileByPath(path) instanceof TFolder;
      feedback.setText(exists ? strings.folderExistsStatus : strings.folderMissingWarning);
      feedback.addClass("is-visible");
      feedback.toggleClass("is-warning", !exists);
    };

    setting.addText((text) => {
      text.setValue(initialValue);
      text.setPlaceholder(strings.taskListSetupFolderPlaceholder);
      text.onChange((value) => {
        onChange(value);
        showStatus(value);
      });

      new FolderSuggest(this.app, text.inputEl).onSelect((folder) => {
        onChange(folder.path);
        text.setValue(folder.path);
        showStatus(folder.path);
      });

      if (focus) {
        window.setTimeout(() => text.inputEl.focus());
      }
    });

    showStatus(initialValue);
  }

  private buildConfig(config: {
    name: string;
    color: TaskListColor;
    activeFolder: string;
    completionBehavior: CompletionBehavior;
    newTaskName: string;
    taskTemplate: string;
    order: TaskOrder;
  }): NewTaskListConfig {
    return {
      name: config.name.trim(),
      color: config.color,
      activeFolder: this.normalizeOptionalFolder(config.activeFolder),
      completionBehavior: config.completionBehavior.type === "move"
        ? {
            type: "move",
            completedFolder: this.normalizeOptionalFolder(
              config.completionBehavior.completedFolder,
            ),
          }
        : { type: "keep" },
      newTaskName: config.newTaskName.trim(),
      taskTemplate: config.taskTemplate.trim(),
      order: config.order,
    };
  }

  private normalizeOptionalFolder(value: string): string {
    const trimmedValue = value.trim();

    return trimmedValue ? normalizeFolderPath(trimmedValue) : "";
  }

  private showError(element: HTMLElement, message: string): void {
    element.setText(message);
    element.addClass("is-visible", "is-error");
  }
}
