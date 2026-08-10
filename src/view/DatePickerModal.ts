import { App, Modal, Notice, Setting } from "obsidian";

import {
  formatDateByPattern,
  formatDateId,
  momentFormatToPattern,
  parseDateByPattern,
  parseDateId,
} from "../core/dateUtils";
import strings, { formatLocalizedString } from "../core/localization";
import type { VaultAgendaSettings } from "../core/types";

export class DatePickerModal extends Modal {
  private value: string;

  constructor(
    app: App,
    private readonly settings: VaultAgendaSettings,
    currentDateId: string,
    private readonly onSubmit: (dateId: string) => void,
  ) {
    super(app);

    this.value = formatDateByPattern(
      parseDateId(currentDateId),
      momentFormatToPattern(settings.dateFormat),
    );
  }

  onOpen(): void {
    this.setTitle(strings.changeDateModalTitle);

    const submit = (): void => {
      const dateId = this.parseValue();

      if (!dateId) {
        new Notice(
          formatLocalizedString(strings.invalidDateError, { format: this.settings.dateFormat }),
        );
        return;
      }

      this.close();
      this.onSubmit(dateId);
    };

    new Setting(this.contentEl)
      .setName(
        formatLocalizedString(strings.changeDateModalDescription, {
          format: this.settings.dateFormat,
        }),
      )
      .addText((text) =>
        text
          .setPlaceholder(this.settings.dateFormat)
          .setValue(this.value)
          .onChange((value) => {
            this.value = value;
          })
          .inputEl.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }),
      );

    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText(strings.changeDateModalSubmitLabel).setCta().onClick(submit),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private parseValue(): string | null {
    const parsed = parseDateByPattern(
      this.value.trim(),
      momentFormatToPattern(this.settings.dateFormat),
    );

    return parsed ? formatDateId(parsed.year, parsed.month, parsed.day) : null;
  }
}
