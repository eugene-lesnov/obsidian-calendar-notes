import { App, Modal, Setting } from "obsidian";

import strings, { formatLocalizedString } from "../core/localization";
import type { DateFormatMigrationPlan } from "../data/dateFormatMigration";

export class DateFormatMigrationModal extends Modal {
  constructor(
    app: App,
    private readonly plan: DateFormatMigrationPlan,
    private readonly currentFormat: string,
    private readonly nextFormat: string,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(strings.dateFormatMigrationTitle);

    this.contentEl.createEl("p", {
      text: formatLocalizedString(strings.dateFormatMigrationSummary, {
        from: this.currentFormat,
        to: this.nextFormat,
      }),
    });

    this.contentEl.createEl("p", {
      text: formatLocalizedString(strings.dateFormatMigrationCounts, {
        items: String(this.plan.entries.length),
        renames: String(this.plan.renameCount),
      }),
    });

    if (this.plan.sample) {
      this.contentEl.createEl("p", {
        text: formatLocalizedString(strings.dateFormatMigrationSample, {
          from: this.plan.sample.from,
          to: this.plan.sample.to,
        }),
      });
    }

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText(strings.dateFormatMigrationCancelLabel).onClick(() => this.close()),
      )
      .addButton((button) =>
        button
          .setButtonText(strings.dateFormatMigrationConfirmLabel)
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
