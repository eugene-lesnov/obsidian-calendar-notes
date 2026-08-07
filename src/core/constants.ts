import { DEFAULT_DATE_FORMAT } from "./dateUtils";
import strings from "./localization";
import type { CalendarSettings } from "./types";

export const VIEW_TYPE_CALENDAR = "calendar-notes-view";
export const RIBBON_ICON = "calendar-days";
export const COMMAND_TOGGLE_CALENDAR = "toggle-calendar-notes";
export const HOVER_LINK_SOURCE = "calendar-notes";
export const MARKDOWN_EXTENSION = "md";

export function createDefaultSettings(): CalendarSettings {
  return {
    dateFormat: DEFAULT_DATE_FORMAT,
    weekStart: "monday",
    calendarItemsFolder: strings.defaultNewItemFolder,
    newNoteName: strings.newNoteDefaultTitle,
    newTaskName: strings.newTaskDefaultTitle,
    noteTemplate: "",
    taskTemplate: "",
  };
}
