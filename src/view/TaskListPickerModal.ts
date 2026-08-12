import { App, SuggestModal } from "obsidian";

import strings from "../core/localization";
import type { TaskList } from "../core/types";

export class TaskListPickerModal extends SuggestModal<TaskList> {
  private settled = false;

  constructor(
    app: App,
    private readonly taskLists: TaskList[],
    private readonly onResult: (taskList: TaskList | null) => void,
  ) {
    super(app);
    this.modalEl.addClass("vault-agenda-task-list-picker-modal");
    this.setPlaceholder(strings.selectTaskListPlaceholder);
  }

  getSuggestions(query: string): TaskList[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return normalizedQuery
      ? this.taskLists.filter((taskList) =>
        taskList.name.toLocaleLowerCase().includes(normalizedQuery))
      : this.taskLists;
  }

  renderSuggestion(taskList: TaskList, element: HTMLElement): void {
    element.setText(taskList.name);
  }

  selectSuggestion(taskList: TaskList, event: MouseEvent | KeyboardEvent): void {
    this.settled = true;
    super.selectSuggestion(taskList, event);
  }

  onChooseSuggestion(taskList: TaskList): void {
    this.onResult(taskList);
  }

  onClose(): void {
    super.onClose();

    if (!this.settled) {
      this.settled = true;
      this.onResult(null);
    }
  }
}
