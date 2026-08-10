import { App, HoverParent, setIcon } from "obsidian";

import { HOVER_LINK_SOURCE } from "../core/constants";
import strings from "../core/localization";
import type { TaskList } from "../core/types";
import type { Task } from "../data/item";
import {
  type ItemCallbacks,
  registerItemTitleTooltip,
  renderTaskRepeatMeta,
} from "./daySection";

export type TaskListsSectionParams = ItemCallbacks & {
  app: App;
  hoverParent: HoverParent;
  taskLists: TaskList[];
  expanded: boolean;
  getTasks: (taskListId: string) => Task[];
  isExpanded: (taskListId: string) => boolean;
  onToggleSectionExpanded: () => void;
  onToggleTaskListExpanded: (taskListId: string) => void;
  onCreateTask: (taskList: TaskList) => void;
};

function renderTask(
  list: HTMLElement,
  task: Task,
  params: TaskListsSectionParams,
): void {
  const item = list.createEl("li", { cls: "vault-agenda-item-row" });
  const checkbox = item.createEl("input", {
    cls: "vault-agenda-task-checkbox",
    type: "checkbox",
  });
  checkbox.setAttribute("aria-label", task.title);
  checkbox.addEventListener("change", () => params.onToggleTaskCompleted(task, checkbox.checked));

  const body = item.createDiv({ cls: "vault-agenda-item-body" });
  const title = body.createEl("button", {
    cls: "vault-agenda-item vault-agenda-item-title",
    text: task.title,
  });
  registerItemTitleTooltip(title, task.title);
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
  renderTaskRepeatMeta(body, task);

  const menuButton = item.createEl("button", {
    cls: "vault-agenda-icon-button vault-agenda-item-menu-button",
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

  const root = container.createDiv({ cls: "vault-agenda-task-lists" });
  const sectionToggle = root.createEl("button", {
    cls: "vault-agenda-section-title vault-agenda-task-lists-title",
  });
  sectionToggle.setAttribute("aria-expanded", String(params.expanded));
  const sectionToggleIcon = sectionToggle.createSpan({
    cls: "vault-agenda-task-lists-title-icon",
  });
  setIcon(sectionToggleIcon, params.expanded ? "chevron-down" : "chevron-right");
  sectionToggle.createSpan({ text: strings.taskListsSectionLabel });
  sectionToggle.addEventListener("click", params.onToggleSectionExpanded);

  if (!params.expanded) {
    return;
  }

  params.taskLists.forEach((taskList) => {
    const tasks = params.getTasks(taskList.id);
    const expanded = params.isExpanded(taskList.id);
    const section = root.createDiv({ cls: "vault-agenda-task-list" });

    if (taskList.color !== null) {
      section.style.setProperty("--vault-agenda-task-list-color", taskList.color);
    }

    const header = section.createDiv({ cls: "vault-agenda-section-header" });
    const toggle = header.createEl("button", {
      cls: "vault-agenda-task-list-toggle",
    });
    const icon = toggle.createSpan({ cls: "vault-agenda-task-list-toggle-icon" });
    setIcon(icon, expanded ? "chevron-down" : "chevron-right");

    if (taskList.color !== null) {
      toggle.createSpan({ cls: "vault-agenda-task-list-color-marker" });
    }

    toggle.createSpan({ text: taskList.name });
    toggle.createSpan({
      cls: "vault-agenda-task-list-count",
      text: `(${tasks.length})`,
    });
    toggle.addEventListener("click", () => params.onToggleTaskListExpanded(taskList.id));

    const addButton = header.createEl("button", {
      cls: "vault-agenda-icon-button",
    });
    addButton.setAttribute("aria-label", strings.createTaskButtonTitle);
    setIcon(addButton, "plus");
    addButton.addEventListener("click", () => params.onCreateTask(taskList));

    if (!expanded) {
      return;
    }

    if (tasks.length === 0) {
      section.createDiv({ cls: "vault-agenda-empty-label", text: strings.emptyTasksLabel });
      return;
    }

    const list = section.createEl("ul", { cls: "vault-agenda-item-list" });
    tasks.forEach((task) => renderTask(list, task, params));
  });
}
