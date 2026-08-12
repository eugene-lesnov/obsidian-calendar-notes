import { App, ButtonComponent, Modal, Notice } from "obsidian";

import {
  DEFAULT_DATE_PATTERN,
  formatDateId,
  parseDateByPattern,
} from "../core/dateUtils";
import strings from "../core/localization";

export class DatePickerModal extends Modal {
  private value: string;

  constructor(
    app: App,
    currentDateId: string,
    private readonly onSubmit: (dateId: string) => void,
  ) {
    super(app);

    this.value = currentDateId;
  }

  onOpen(): void {
    this.setTitle(strings.changeDateModalTitle);
    this.modalEl.addClass("vault-agenda-date-picker-modal");

    const submit = (): void => {
      const dateId = this.parseValue();

      if (!dateId) {
        new Notice(strings.invalidDateError);
        return;
      }

      this.close();
      this.onSubmit(dateId);
    };

    const field = this.contentEl.createEl("label", {
      cls: "vault-agenda-date-picker-field",
    });
    field.createSpan({ text: strings.changeDateModalDescription });

    const input = field.createEl("input", {
      cls: "vault-agenda-date-picker-input",
      attr: { type: "date" },
    });
    input.value = this.value;
    input.addEventListener("input", () => {
      this.value = input.value;
    });
    input.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });

    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    new ButtonComponent(actions)
      .setButtonText(strings.changeDateModalSubmitLabel)
      .setCta()
      .onClick(submit);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private parseValue(): string | null {
    const parsed = parseDateByPattern(this.value, DEFAULT_DATE_PATTERN);

    return parsed ? formatDateId(parsed.year, parsed.month, parsed.day) : null;
  }
}
