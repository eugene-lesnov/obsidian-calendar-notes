import { AbstractInputSuggest, App, TFolder, prepareSimpleSearch } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  protected getSuggestions(query: string): TFolder[] {
    const normalizedQuery = query.trim();
    const matches = normalizedQuery ? prepareSimpleSearch(normalizedQuery) : null;

    return this.app.vault
      .getAllFolders()
      .filter((folder) => !matches || matches(folder.path) !== null)
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }
}
