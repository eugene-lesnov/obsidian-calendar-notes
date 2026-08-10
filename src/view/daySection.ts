import { App, HoverParent, TFile, setIcon } from "obsidian";

import { HOVER_LINK_SOURCE } from "../core/constants";
import strings, { formatLocalizedString, getRepeatLabel } from "../core/localization";
import type { TaskListColor } from "../core/types";
import type { Item, Task } from "../data/item";

const COLLAPSED_OVERDUE_TASK_COUNT = 3;

export type ItemCallbacks = {
  getTaskListColor: (taskListId: string) => TaskListColor;
  onToggleTaskCompleted: (item: Task, completed: boolean) => void;
  onOpen: (item: Item, event: MouseEvent) => void;
  onMenu: (item: Item, event: MouseEvent) => void;
};

export type DaySectionParams = ItemCallbacks & {
  app: App;
  hoverParent: HoverParent;
  dateId: string;
  items: Item[];
  onCreateNote: () => void;
  onCreateTask: () => void;
  formatDayLabel: (dateId: string) => string;
};

export type OverdueSectionParams = ItemCallbacks & {
  app: App;
  hoverParent: HoverParent;
  items: Task[];
  total: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  formatDayLabel: (dateId: string) => string;
};

function registerHoverPreview(
  app: App,
  hoverParent: HoverParent,
  targetEl: HTMLElement,
  file: TFile,
): void {
  targetEl.addEventListener("mouseover", (event: MouseEvent) => {
    app.workspace.trigger("hover-link", {
      event,
      source: HOVER_LINK_SOURCE,
      hoverParent,
      targetEl,
      linktext: file.path,
    });
  });
}

function renderSectionHeader(
  section: HTMLElement,
  label: string,
  addTitle: string,
  onAdd: () => void,
): void {
  const header = section.createDiv({ cls: "calendar-section-header" });

  header.createDiv({ cls: "calendar-section-title", text: label });

  const addButton = header.createEl("button", {
    cls: "calendar-icon-button calendar-add-button",
  });

  addButton.setAttribute("aria-label", addTitle);
  setIcon(addButton, "plus");
  addButton.addEventListener("click", onAdd);
}

function renderCheckbox(item: HTMLElement, entry: Task, callbacks: ItemCallbacks): void {
  const checkbox = item.createEl("input", {
    cls: "calendar-task-checkbox",
    type: "checkbox",
  });

  checkbox.checked = entry.done;
  checkbox.setAttribute("aria-label", entry.title);
  checkbox.addEventListener("click", (event: MouseEvent) => event.stopPropagation());
  checkbox.addEventListener("change", () => callbacks.onToggleTaskCompleted(entry, checkbox.checked));
}

export function renderTaskRepeatMeta(body: HTMLElement, task: Task): void {
  if (!task.repeat) {
    return;
  }

  body.createDiv({
    cls: "calendar-task-repeat-meta",
    text: formatLocalizedString(strings.taskRepeatMetaLabel, {
      repeat: getRepeatLabel(task.repeat.frequency),
    }),
  });
}

function renderItemRow(
  list: HTMLElement,
  app: App,
  hoverParent: HoverParent,
  entry: Item,
  callbacks: ItemCallbacks,
  datePrefix: string,
): void {
  const item = list.createEl("li", { cls: "calendar-item-row" });

  if (entry.kind === "task") {
    const color = callbacks.getTaskListColor(entry.taskListId);

    if (color !== null) {
      item.addClass("is-list-colored");
      item.style.setProperty("--calendar-task-list-color", color);
    }
  }

  item.toggleClass("is-completed", entry.kind === "task" && entry.done);

  if (entry.kind === "task") {
    renderCheckbox(item, entry, callbacks);
  }

  const body = item.createDiv({ cls: "calendar-item-body" });
  const title = body.createEl("button", { cls: "calendar-item calendar-item-title" });

  title.setAttribute("aria-label", entry.title);

  if (datePrefix) {
    title.createSpan({ cls: "calendar-task-date-prefix", text: datePrefix });
  }

  title.createSpan({ text: entry.title });
  title.addEventListener("click", (event: MouseEvent) => callbacks.onOpen(entry, event));
  registerHoverPreview(app, hoverParent, title, entry.file);

  if (entry.kind === "task") {
    renderTaskRepeatMeta(body, entry);
  }

  const menuButton = item.createEl("button", {
    cls: "calendar-icon-button calendar-item-menu-button",
  });

  menuButton.setAttribute("aria-label", strings.itemActionsLabel);
  setIcon(menuButton, "more-vertical");
  menuButton.addEventListener("click", (event: MouseEvent) => {
    event.stopPropagation();
    callbacks.onMenu(entry, event);
  });
}

function renderItemList(
  section: HTMLElement,
  app: App,
  hoverParent: HoverParent,
  items: Item[],
  callbacks: ItemCallbacks,
  emptyLabel: string | null,
  formatDatePrefix: ((entry: Item) => string) | null,
): void {
  if (items.length === 0) {
    if (emptyLabel) {
      section.createDiv({ cls: "calendar-empty-label", text: emptyLabel });
    }

    return;
  }

  const list = section.createEl("ul", { cls: "calendar-item-list" });

  items.forEach((entry) => {
    renderItemRow(
      list,
      app,
      hoverParent,
      entry,
      callbacks,
      formatDatePrefix ? formatDatePrefix(entry) : "",
    );
  });
}

export function renderOverdueSection(
  container: HTMLElement,
  params: OverdueSectionParams,
): void {
  if (params.total === 0) {
    return;
  }

  const root = container.createDiv({ cls: "calendar-overdue-section" });
  const header = root.createDiv({ cls: "calendar-section-header" });

  header.createDiv({
    cls: "calendar-section-title calendar-overdue-title",
    text: formatLocalizedString(strings.overdueTasksLabel, {
      count: params.total,
    }),
  });

  const visibleItems = params.expanded
    ? params.items
    : params.items.slice(0, COLLAPSED_OVERDUE_TASK_COUNT);

  if (params.total > COLLAPSED_OVERDUE_TASK_COUNT) {
    const toggleLabel = params.expanded
      ? strings.hideOverdueTasksLabel
      : strings.showAllOverdueTasksLabel;
    const toggle = header.createEl("button", {
      cls: "calendar-icon-button calendar-overdue-toggle",
    });

    toggle.setAttribute("aria-label", toggleLabel);
    setIcon(toggle, params.expanded ? "chevron-down" : "chevron-right");
    toggle.addEventListener("click", params.onToggleExpanded);
  }

  renderItemList(
    root,
    params.app,
    params.hoverParent,
    visibleItems,
    params,
    null,
    (entry) => entry.dateId ? params.formatDayLabel(entry.dateId) : "",
  );
}

export function renderDaySection(container: HTMLElement, params: DaySectionParams): void {
  const root = container.createDiv({ cls: "calendar-selected-day" });

  root.createDiv({
    cls: "calendar-selected-day-title",
    text: formatLocalizedString(strings.selectedDayLabel, {
      date: params.formatDayLabel(params.dateId),
    }),
  });

  const tasksSection = root.createDiv({ cls: "calendar-day-section" });

  renderSectionHeader(
    tasksSection,
    strings.tasksSectionLabel,
    strings.createTaskButtonTitle,
    params.onCreateTask,
  );

  renderItemList(
    tasksSection,
    params.app,
    params.hoverParent,
    params.items.filter((entry) => entry.kind === "task"),
    params,
    strings.emptyTasksLabel,
    null,
  );

  const notesSection = root.createDiv({ cls: "calendar-day-section" });

  renderSectionHeader(
    notesSection,
    strings.notesSectionLabel,
    strings.createNoteButtonTitle,
    params.onCreateNote,
  );

  renderItemList(
    notesSection,
    params.app,
    params.hoverParent,
    params.items.filter((entry) => entry.kind === "note"),
    params,
    strings.emptyNotesLabel,
    null,
  );
}
