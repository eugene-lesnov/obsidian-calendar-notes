import { DEFAULT_DATE_FORMAT } from "./dateUtils";
import strings from "./localization";
import { buildDefaultNotesFolder } from "./pathDefaults";
import type { VaultAgendaSettings } from "./types";

export const VIEW_TYPE_AGENDA = "vault-agenda-view";
export const RIBBON_ICON = "calendar-days";
export const COMMAND_TOGGLE_AGENDA = "toggle-vault-agenda";
export const HOVER_LINK_SOURCE = "vault-agenda";
export const MARKDOWN_EXTENSION = "md";
export const DEFAULT_TASK_LIST_COLOR = "#7e57c2";
export function createDefaultSettings(): VaultAgendaSettings {
  return {
    dateFormat: DEFAULT_DATE_FORMAT,
    weekStart: "monday",
    notesFolder: buildDefaultNotesFolder(strings.notesFolderName),
    taskLists: [],
    expandedTaskListIds: [],
    newNoteName: strings.newNoteDefaultTitle,
    noteTemplate: "",
  };
}
