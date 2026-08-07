import { App, TFolder, normalizePath } from "obsidian";

import { MARKDOWN_EXTENSION } from "../core/constants";
import { formatLocalizedString } from "../core/localization";
import { ensureFolder, joinPath } from "./folders";

const FORBIDDEN_FILE_NAME_CHARS_GLOBAL = /[\\/:*?"<>|]/g;

export const MARKDOWN_SUFFIX = `.${MARKDOWN_EXTENSION}`;

export function replaceForbiddenChars(name: string): string {
  return name.replace(FORBIDDEN_FILE_NAME_CHARS_GLOBAL, "-");
}

export function sanitizeFileName(name: string): string {
  return replaceForbiddenChars(name).trim();
}

export function makeUniquePath(app: App, folderPath: string, baseName: string): string {
  const buildPath = (name: string): string =>
    normalizePath(joinPath(folderPath, `${name}${MARKDOWN_SUFFIX}`));

  let candidate = buildPath(baseName);

  if (!app.vault.getAbstractFileByPath(candidate)) {
    return candidate;
  }

  let index = 2;

  while (true) {
    candidate = buildPath(`${baseName} (${index})`);

    if (!app.vault.getAbstractFileByPath(candidate)) {
      return candidate;
    }

    index += 1;
  }
}

export async function ensureFolderOrThrow(
  app: App,
  folderPath: string,
  errorTemplate: string,
): Promise<TFolder> {
  try {
    return await ensureFolder(app, folderPath);
  } catch (error) {
    console.warn("Failed to create folder.", error);

    throw new Error(formatLocalizedString(errorTemplate, { path: folderPath }));
  }
}
