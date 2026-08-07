import { App, TAbstractFile, TFolder, normalizePath } from "obsidian";

export function joinPath(...segments: string[]): string {
  const parts = segments
    .flatMap((segment) => segment.replace(/\\/g, "/").split("/"))
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..");

  return parts.join("/");
}

export async function ensureFolder(app: App, path: string): Promise<TFolder> {
  const normalized = normalizePath(joinPath(path));

  if (!normalized || normalized === "/") {
    return app.vault.getRoot();
  }

  const existing = app.vault.getAbstractFileByPath(normalized);

  if (existing instanceof TFolder) {
    return existing;
  }

  if (existing) {
    throw new Error(`Path is not a folder: ${normalized}`);
  }

  const segments = normalized.split("/");
  let current = "";

  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;

    const found: TAbstractFile | null = app.vault.getAbstractFileByPath(current);

    if (found instanceof TFolder) {
      continue;
    }

    if (found) {
      throw new Error(`Path is not a folder: ${current}`);
    }

    try {
      await app.vault.createFolder(current);
    } catch (error) {
      if (!(app.vault.getAbstractFileByPath(current) instanceof TFolder)) {
        throw error;
      }
    }
  }

  const created = app.vault.getAbstractFileByPath(normalized);

  if (!(created instanceof TFolder)) {
    throw new Error(`Failed to create folder: ${normalized}`);
  }

  return created;
}
