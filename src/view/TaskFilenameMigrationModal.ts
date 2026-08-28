import { App, Modal, Setting } from "obsidian";

import strings, { formatLocalizedString } from "../core/localization";
import type { TaskFilenameMigrationPlan } from "../data/taskFilenameMigration";

export class TaskFilenameMigrationModal extends Modal {
  constructor(
    app: App,
    private readonly plan: TaskFilenameMigrationPlan,
    private readonly enabled: boolean,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(strings.taskFilenameMigrationTitle);

    this.contentEl.createEl("p", {
      text: this.enabled
        ? strings.taskFilenameMigrationEnableSummary
        : strings.taskFilenameMigrationDisableSummary,
    });
    this.contentEl.createEl("p", {
      text: formatLocalizedString(strings.taskFilenameMigrationCount, {
        count: String(this.plan.entries.length),
      }),
    });

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText(strings.cancelLabel).onClick(() => this.close()),
      )
      .addButton((button) =>
        button
          .setButtonText(strings.taskFilenameMigrationConfirmLabel)
          .setCta()
          .onClick(() => {
            this.close();
            this.onConfirm();
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
