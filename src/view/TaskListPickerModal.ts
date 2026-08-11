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

  onChooseSuggestion(taskList: TaskList): void {
    this.settled = true;
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
