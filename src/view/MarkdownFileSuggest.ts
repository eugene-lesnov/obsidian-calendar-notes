import { AbstractInputSuggest, App, TFile, prepareSimpleSearch } from "obsidian";

export class MarkdownFileSuggest extends AbstractInputSuggest<TFile> {
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  protected getSuggestions(query: string): TFile[] {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    const matches = prepareSimpleSearch(normalizedQuery);

    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => matches(file.path) !== null)
      .sort((left, right) => left.path.localeCompare(right.path))
      .slice(0, 20);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }
}
