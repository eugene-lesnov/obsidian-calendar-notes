export const VAULT_AGENDA_ROOT_FOLDER = "Vault Agenda";

export function buildDefaultNotesFolder(notesFolderName: string): string {
  return `${VAULT_AGENDA_ROOT_FOLDER}/${notesFolderName}`;
}

export function buildDefaultTemplatePath(
  templatesFolderName: string,
  templateName: string,
): string {
  return `${templatesFolderName}/${templateName}.md`;
}

export type TaskFolderNames = {
  taskLists: string;
  defaultTaskList: string;
  active: string;
  completed: string;
};

export type TaskListFolders = {
  activeFolder: string;
  completedFolder: string;
};

export function buildTaskListFolders(
  folderName: string,
  names: Pick<TaskFolderNames, "taskLists" | "active" | "completed">,
): TaskListFolders {
  const root = `${VAULT_AGENDA_ROOT_FOLDER}/${names.taskLists}/${folderName}`;

  return {
    activeFolder: `${root}/${names.active}`,
    completedFolder: `${root}/${names.completed}`,
  };
}

export function buildDefaultTaskListFolders(names: TaskFolderNames): TaskListFolders {
  return buildTaskListFolders(names.defaultTaskList, names);
}

export function buildAdditionalTaskListFolders(
  folderName: string,
  names: Pick<TaskFolderNames, "taskLists" | "active" | "completed">,
): TaskListFolders {
  return buildTaskListFolders(folderName, names);
}

export function suggestCompletedFolder(
  activeFolder: string,
  activeFolderName: string,
  completedFolderName: string,
): string {
  const normalized = activeFolder.replace(/\\/g, "/").replace(/\/+$/, "");

  if (!normalized) {
    return completedFolderName;
  }

  const separatorIndex = normalized.lastIndexOf("/");
  const parent = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : "";
  const name = separatorIndex >= 0 ? normalized.slice(separatorIndex + 1) : normalized;

  if (name.toLocaleLowerCase() === activeFolderName.toLocaleLowerCase()) {
    return parent ? `${parent}/${completedFolderName}` : completedFolderName;
  }

  return `${normalized} ${completedFolderName}`;
}
