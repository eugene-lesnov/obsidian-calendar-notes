import { AbstractInputSuggest, App, TFile, prepareSimpleSearch } from "obsidian";

export class MarkdownFileSuggest extends AbstractInputSuggest<TFile> {
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  protected getSuggestions(query: string): TFile[] {
    const normalizedQuery = query.trim();
    const matches = normalizedQuery ? prepareSimpleSearch(normalizedQuery) : null;

    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => !matches || matches(file.path) !== null)
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }
}
