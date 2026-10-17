export const CALENDAR_NOTES_ROOT_FOLDER = "Calendar Notes";

export function buildDefaultNotesFolder(notesFolderName: string): string {
  return `${CALENDAR_NOTES_ROOT_FOLDER}/${notesFolderName}`;
}

export function buildDefaultTemplatePath(
  templatesFolderName: string,
  templateName: string,
): string {
  return `${templatesFolderName}/${templateName}.md`;
}
