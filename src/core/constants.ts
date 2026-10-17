import { DEFAULT_DATE_FORMAT } from "./dateUtils";
import strings from "./localization";
import { buildDefaultNotesFolder } from "./pathDefaults";
import type { CalendarNotesSettings } from "./types";

export const VIEW_TYPE_CALENDAR_NOTES = "calendar-notes-view";
export const RIBBON_ICON = "calendar-days";
export const COMMAND_TOGGLE_CALENDAR_NOTES = "toggle-calendar";
export const HOVER_LINK_SOURCE = "calendar-notes";
export const ITEM_MARKER_FIELD = "calendarNotesItem";
export const MARKDOWN_EXTENSION = "md";
export const DEFAULT_TASK_LIST_COLOR = "#7e57c2";
export function createDefaultSettings(): CalendarNotesSettings {
  return {
    dateFormat: DEFAULT_DATE_FORMAT,
    weekStart: "monday",
    syncTaskDateWithFilename: false,
    notesFolder: buildDefaultNotesFolder(strings.notesFolderName),
    taskLists: [],
    taskListsExpanded: false,
    expandedTaskListIds: [],
    newNoteName: strings.newNoteDefaultTitle,
    noteTemplate: "",
  };
}
