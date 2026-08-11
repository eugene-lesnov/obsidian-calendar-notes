import { App, HoverParent, Menu, setIcon, setTooltip } from "obsidian";

import { HOVER_LINK_SOURCE } from "../core/constants";
import strings from "../core/localization";
import type { TaskList, TaskOrder } from "../core/types";
import type { Task } from "../data/item";
import {
  type ItemCallbacks,
  registerItemTitleTooltip,
  renderTaskRepeatMeta,
} from "./daySection";

const TASK_ORDER_OPTIONS: Array<{ order: TaskOrder; label: () => string }> = [
  { order: "title-asc", label: () => strings.taskOrderTitleAscLabel },
  { order: "title-desc", label: () => strings.taskOrderTitleDescLabel },
  { order: "date-asc", label: () => strings.taskOrderDateAscLabel },
  { order: "date-desc", label: () => strings.taskOrderDateDescLabel },
  { order: "manual", label: () => strings.taskOrderManualLabel },
];
const TASK_PATH_DRAG_TYPE = "application/x-vault-agenda-task-path";
const activeDropTargets = new WeakMap<HTMLElement, HTMLElement>();

function clearDropIndicators(list: HTMLElement): void {
  activeDropTargets.get(list)?.removeClass("is-drop-before", "is-drop-after");
  activeDropTargets.delete(list);
}

function setDropIndicator(list: HTMLElement, item: HTMLElement, after: boolean): void {
  const previousTarget = activeDropTargets.get(list);

  if (previousTarget !== item) {
    previousTarget?.removeClass("is-drop-before", "is-drop-after");
    activeDropTargets.set(list, item);
  }

  item.toggleClass("is-drop-before", !after);
  item.toggleClass("is-drop-after", after);
}

function getTaskOrderLabel(order: TaskOrder): string {
  return TASK_ORDER_OPTIONS.find((option) => option.order === order)?.label() ?? "";
}

export type TaskListsSectionParams = Omit<ItemCallbacks, "onMenu"> & {
  app: App;
  hoverParent: HoverParent;
  taskLists: TaskList[];
  expanded: boolean;
  getTasks: (taskListId: string) => Task[];
  isExpanded: (taskListId: string) => boolean;
  onToggleSectionExpanded: () => void;
  onToggleTaskListExpanded: (taskListId: string) => void;
  onCreateTask: (taskList: TaskList) => void;
  onSetOrder: (taskList: TaskList, order: TaskOrder) => void;
  onReorderTask: (
    taskList: TaskList,
    sourcePath: string,
    targetPath: string,
    after: boolean,
  ) => void;
  onTaskMenu: (taskList: TaskList, task: Task, event: MouseEvent) => void;
};

function renderTask(
  list: HTMLElement,
  taskList: TaskList,
  task: Task,
  params: TaskListsSectionParams,
): void {
  const item = list.createEl("li", { cls: "vault-agenda-item-row" });

  if (taskList.order === "manual") {
    item.addClass("is-manually-ordered");

    const dragHandle = item.createSpan({ cls: "vault-agenda-task-drag-handle" });
    dragHandle.draggable = true;
    dragHandle.setAttribute("aria-hidden", "true");
    setIcon(dragHandle, "grip-vertical");

    item.addEventListener("dragstart", (event: DragEvent) => {
      list.dataset.draggedTaskPath = task.file.path;

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(TASK_PATH_DRAG_TYPE, task.file.path);
        event.dataTransfer.setDragImage(item, 12, 12);
      }

      item.addClass("is-dragging");
    });
    item.addEventListener("dragend", () => {
      delete list.dataset.draggedTaskPath;
      clearDropIndicators(list);
      item.removeClass("is-dragging");
    });
    item.addEventListener("dragover", (event: DragEvent) => {
      const sourcePath = list.dataset.draggedTaskPath;

      if (!sourcePath || sourcePath === task.file.path) {
        clearDropIndicators(list);
        return;
      }

      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }

      const bounds = item.getBoundingClientRect();
      const after = event.clientY > bounds.top + bounds.height / 2;
      setDropIndicator(list, item, after);
    });
    item.addEventListener("dragleave", (event: DragEvent) => {
      if (event.relatedTarget instanceof Node && item.contains(event.relatedTarget)) {
        return;
      }

      if (activeDropTargets.get(list) === item) {
        clearDropIndicators(list);
      }
    });
    item.addEventListener("drop", (event: DragEvent) => {
      event.preventDefault();
      const sourcePath = list.dataset.draggedTaskPath
        ?? event.dataTransfer?.getData(TASK_PATH_DRAG_TYPE);

      clearDropIndicators(list);

      if (!sourcePath || sourcePath === task.file.path) {
        return;
      }

      const bounds = item.getBoundingClientRect();
      params.onReorderTask(
        taskList,
        sourcePath,
        task.file.path,
        event.clientY > bounds.top + bounds.height / 2,
      );
    });
  }

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
  menuButton.addEventListener("click", (event) => params.onTaskMenu(taskList, task, event));
}

function showTaskOrderMenu(
  event: MouseEvent,
  taskList: TaskList,
  onSetOrder: (order: TaskOrder) => void,
): void {
  const menu = new Menu();

  TASK_ORDER_OPTIONS.forEach((option) => {
    menu.addItem((item) => item
      .setTitle(option.label())
      .setChecked(taskList.order === option.order)
      .onClick(() => onSetOrder(option.order)));
  });
  menu.showAtMouseEvent(event);
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

    const orderButton = header.createEl("button", {
      cls: "vault-agenda-icon-button vault-agenda-task-order-button",
    });
    const orderLabel = `${strings.taskOrderLabel}: ${getTaskOrderLabel(taskList.order)}`;
    orderButton.setAttribute("aria-label", orderLabel);
    setTooltip(orderButton, orderLabel);
    setIcon(orderButton, "arrow-up-down");
    orderButton.addEventListener("click", (event) => {
      showTaskOrderMenu(event, taskList, (order) => params.onSetOrder(taskList, order));
    });

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
    list.toggleClass("is-manually-ordered", taskList.order === "manual");
    tasks.forEach((task) => renderTask(list, taskList, task, params));
  });
}
