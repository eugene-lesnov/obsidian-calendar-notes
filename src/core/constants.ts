import { DEFAULT_DATE_FORMAT } from "./dateUtils";
import strings from "./localization";
import {
  buildDefaultNotesFolder,
  buildDefaultTaskListFolders,
} from "./pathDefaults";
import type { CalendarSettings } from "./types";

export const VIEW_TYPE_CALENDAR = "calendar-notes-view";
export const RIBBON_ICON = "calendar-days";
export const COMMAND_TOGGLE_CALENDAR = "toggle-calendar-notes";
export const HOVER_LINK_SOURCE = "calendar-notes";
export const MARKDOWN_EXTENSION = "md";
export const DEFAULT_TASK_LIST_ID = "tasks";

export function createDefaultSettings(): CalendarSettings {
  const taskListFolders = buildDefaultTaskListFolders({
    taskLists: strings.taskListsFolderName,
    defaultTaskList: strings.defaultTaskListFolderName,
    active: strings.activeTasksFolderName,
    completed: strings.completedTasksFolderName,
  });

  return {
    dateFormat: DEFAULT_DATE_FORMAT,
    weekStart: "monday",
    notesFolder: buildDefaultNotesFolder(strings.notesFolderName),
    taskLists: [{
      id: DEFAULT_TASK_LIST_ID,
      name: strings.tasksSectionLabel,
      color: null,
      activeFolder: taskListFolders.activeFolder,
      newTaskName: strings.newTaskDefaultTitle,
      taskTemplate: "",
      completionBehavior: {
        type: "move",
        completedFolder: taskListFolders.completedFolder,
      },
    }],
    expandedTaskListIds: [DEFAULT_TASK_LIST_ID],
    newNoteName: strings.newNoteDefaultTitle,
    noteTemplate: "",
  };
}
