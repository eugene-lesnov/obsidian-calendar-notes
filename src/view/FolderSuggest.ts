import {
  AbstractInputSuggest,
  App,
  TFolder,
  normalizePath,
  prepareSimpleSearch,
} from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, private readonly inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  protected getSuggestions(query: string): TFolder[] {
    const normalizedQuery = query.trim();
    const folders = this.app.vault.getAllFolders();

    if (!normalizedQuery) {
      return folders
        .filter((folder) => folder.parent?.isRoot())
        .sort((left, right) => left.path.localeCompare(right.path))
        .slice(0, 20);
    }

    const selectedFolder = this.app.vault.getAbstractFileByPath(normalizePath(normalizedQuery));

    if (selectedFolder instanceof TFolder) {
      return selectedFolder.children
        .filter((child): child is TFolder => child instanceof TFolder)
        .sort((left, right) => left.path.localeCompare(right.path))
        .slice(0, 20);
    }

    const matches = prepareSimpleSearch(normalizedQuery);

    return folders
      .filter((folder) => matches(folder.path) !== null)
      .sort((left, right) => left.path.localeCompare(right.path))
      .slice(0, 20);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder, event: MouseEvent | KeyboardEvent): void {
    super.selectSuggestion(folder, event);

    if (folder.children.some((child) => child instanceof TFolder)) {
      window.setTimeout(() => {
        this.setValue(folder.path);
        this.inputEl.focus();
        this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
  }
}
