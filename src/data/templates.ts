import { App, TFile, getFrontMatterInfo, normalizePath } from "obsidian";

import { formatDateByPattern, momentFormatToPattern, parseDateId } from "../core/dateUtils";
import type { CalendarSettings } from "../core/types";
import { MARKDOWN_SUFFIX } from "./fileNames";

export type TemplateParts = {
  body: string;
  frontmatter: Record<string, unknown>;
};

export function buildDayIdentifier(dateId: string, settings: CalendarSettings): string {
  const date = parseDateId(dateId);

  return formatDateByPattern(date, momentFormatToPattern(settings.dateFormat));
}

function resolveTemplateFile(app: App, templatePath: string): TFile | null {
  const trimmed = templatePath.trim();

  if (!trimmed) {
    return null;
  }

  const withExtension = trimmed.toLowerCase().endsWith(MARKDOWN_SUFFIX)
    ? trimmed
    : `${trimmed}${MARKDOWN_SUFFIX}`;
  const file = app.vault.getAbstractFileByPath(normalizePath(withExtension));

  return file instanceof TFile ? file : null;
}

export async function readTemplateParts(
  app: App,
  templatePath: string,
): Promise<TemplateParts | null> {
  const file = resolveTemplateFile(app, templatePath);

  if (!file) {
    return null;
  }

  const content = await app.vault.cachedRead(file);
  const info = getFrontMatterInfo(content);
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

  return {
    body: info.exists ? content.slice(info.contentStart) : content,
    frontmatter: frontmatter ? { ...frontmatter } : {},
  };
}
