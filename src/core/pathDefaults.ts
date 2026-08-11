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
