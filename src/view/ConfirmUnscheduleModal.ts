import { App, ButtonComponent, Modal } from "obsidian";

import strings from "../core/localization";

export class ConfirmUnscheduleModal extends Modal {
  constructor(app: App, private readonly onConfirm: () => void) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(strings.unscheduleRepeatConfirmTitle);
    this.contentEl.createDiv({ text: strings.unscheduleRepeatConfirmMessage });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });

    new ButtonComponent(actions)
      .setButtonText(strings.cancelLabel)
      .onClick(() => this.close());
    new ButtonComponent(actions)
      .setCta()
      .setButtonText(strings.confirmLabel)
      .onClick(() => {
        this.close();
        this.onConfirm();
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
