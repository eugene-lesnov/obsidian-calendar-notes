import { App, HoverParent, setIcon } from "obsidian";

import { HOVER_LINK_SOURCE } from "../core/constants";
import strings from "../core/localization";
import type { TaskList } from "../core/types";
import type { Task } from "../data/item";
import type { ItemCallbacks } from "./daySection";

export type TaskListsSectionParams = ItemCallbacks & {
  app: App;
  hoverParent: HoverParent;
  taskLists: TaskList[];
  getTasks: (taskListId: string) => Task[];
  isExpanded: (taskListId: string) => boolean;
  onToggleExpanded: (taskListId: string) => void;
  onCreateTask: (taskList: TaskList) => void;
};

function renderTask(
  list: HTMLElement,
  task: Task,
  params: TaskListsSectionParams,
): void {
  const item = list.createEl("li", { cls: "calendar-item-row" });
  const checkbox = item.createEl("input", {
    cls: "calendar-task-checkbox",
    type: "checkbox",
  });
  checkbox.setAttribute("aria-label", task.title);
  checkbox.addEventListener("change", () => params.onToggleTaskCompleted(task, checkbox.checked));

  const title = item.createEl("button", {
    cls: "calendar-item calendar-item-title",
    text: task.title,
  });
  title.addEventListener("click", (event) => params.onOpen(task, event));
  title.addEventListener("mouseover", (event) => {
    params.app.workspace.trigger("hover-link", {
      event,
      source: HOVER_LINK_SOURCE,
      hoverParent: params.hoverParent,
      targetEl: title,
      linktext: task.file.path,
    });
  });

  const menuButton = item.createEl("button", {
    cls: "calendar-icon-button calendar-item-menu-button",
  });
  menuButton.setAttribute("aria-label", strings.itemActionsLabel);
  setIcon(menuButton, "more-vertical");
  menuButton.addEventListener("click", (event) => params.onMenu(task, event));
}

export function renderTaskListsSection(
  container: HTMLElement,
  params: TaskListsSectionParams,
): void {
  if (params.taskLists.length === 0) {
    return;
  }

  const root = container.createDiv({ cls: "calendar-task-lists" });
  root.createDiv({
    cls: "calendar-section-title calendar-task-lists-title",
    text: strings.taskListsSectionLabel,
  });

  params.taskLists.forEach((taskList) => {
    const tasks = params.getTasks(taskList.id);
    const expanded = params.isExpanded(taskList.id);
    const section = root.createDiv({ cls: "calendar-task-list" });

    if (taskList.color !== null) {
      section.style.setProperty("--calendar-task-list-color", taskList.color);
    }

    const header = section.createDiv({ cls: "calendar-section-header" });
    const toggle = header.createEl("button", {
      cls: "calendar-task-list-toggle",
    });
    const icon = toggle.createSpan({ cls: "calendar-task-list-toggle-icon" });
    setIcon(icon, expanded ? "chevron-down" : "chevron-right");

    if (taskList.color !== null) {
      toggle.createSpan({ cls: "calendar-task-list-color-marker" });
    }

    toggle.createSpan({ text: taskList.name });
    toggle.createSpan({
      cls: "calendar-task-list-count",
      text: `(${tasks.length})`,
    });
    toggle.addEventListener("click", () => params.onToggleExpanded(taskList.id));

    const addButton = header.createEl("button", {
      cls: "calendar-icon-button",
    });
    addButton.setAttribute("aria-label", strings.createTaskButtonTitle);
    setIcon(addButton, "plus");
    addButton.addEventListener("click", () => params.onCreateTask(taskList));

    if (!expanded) {
      return;
    }

    if (tasks.length === 0) {
      section.createDiv({ cls: "calendar-empty-label", text: strings.emptyTasksLabel });
      return;
    }

    const list = section.createEl("ul", { cls: "calendar-item-list" });
    tasks.forEach((task) => renderTask(list, task, params));
  });
}
