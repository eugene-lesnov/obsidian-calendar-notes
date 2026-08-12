type Frontmatter = Record<string, unknown>;

export class TAbstractFile {
  path: string;
  name: string;
  parent: TFolder | null;

  constructor(path: string, parent: TFolder | null = null) {
    this.path = normalizePath(path);
    this.name = this.path.split("/").at(-1) ?? "";
    this.parent = parent;
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];

  isRoot(): boolean {
    return this.path === "/";
  }
}

export class TFile extends TAbstractFile {
  extension: string;
  basename: string;

  constructor(path: string, parent: TFolder | null = null) {
    super(path, parent);
    const dotIndex = this.name.lastIndexOf(".");
    this.extension = dotIndex >= 0 ? this.name.slice(dotIndex + 1) : "";
    this.basename = dotIndex >= 0 ? this.name.slice(0, dotIndex) : this.name;
  }
}

export class Notice {
  constructor(_message: string) {}
}

export function normalizePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");

  if (!normalized || normalized === "/") {
    return normalized || "/";
  }

  return normalized.replace(/^\//, "").replace(/\/$/, "");
}

export function stringifyYaml(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function getFrontMatterInfo(content: string): {
  exists: boolean;
  contentStart: number;
} {
  const end = content.indexOf("\n---\n", 4);

  return end < 0
    ? { exists: false, contentStart: 0 }
    : { exists: true, contentStart: end + 5 };
}

function parseFrontmatter(content: string): Frontmatter {
  const end = content.indexOf("\n---\n", 4);

  if (!content.startsWith("---\n") || end < 0) {
    return {};
  }

  return JSON.parse(content.slice(4, end)) as Frontmatter;
}

export class FakeApp {
  readonly frontmatter = new WeakMap<TFile, Frontmatter>();
  readonly contents = new WeakMap<TFile, string>();
  readonly root = new TFolder("/");
  readonly files = new Map<string, TAbstractFile>([["/", this.root]]);
  readonly createdPaths: string[] = [];
  processFrontMatterCount = 0;
  renameCount = 0;
  failNextRename = false;
  failNextProcessFrontMatter = false;

  readonly metadataCache = {
    getFileCache: (file: TFile): { frontmatter?: Frontmatter } | null => {
      const frontmatter = this.frontmatter.get(file);

      return frontmatter ? { frontmatter } : null;
    },
  };

  readonly vault = {
    getAbstractFileByPath: (path: string): TAbstractFile | null =>
      this.files.get(normalizePath(path)) ?? null,
    createFolder: async (path: string): Promise<TFolder> => this.addFolder(path),
    create: async (path: string, content: string): Promise<TFile> => {
      if (this.files.has(normalizePath(path))) {
        throw new Error(`File already exists: ${path}`);
      }

      const file = this.addFile(path, parseFrontmatter(content));
      this.contents.set(file, content);
      this.createdPaths.push(file.path);

      return file;
    },
    cachedRead: async (file: TFile): Promise<string> => this.contents.get(file) ?? "",
    getMarkdownFiles: (): TFile[] => Array.from(this.files.values())
      .filter((file): file is TFile => file instanceof TFile && file.extension === "md"),
    getRoot: (): TFolder => this.root,
  };

  readonly fileManager = {
    processFrontMatter: async (
      file: TFile,
      update: (frontmatter: Frontmatter) => void,
    ): Promise<void> => {
      this.processFrontMatterCount += 1;

      if (this.failNextProcessFrontMatter) {
        this.failNextProcessFrontMatter = false;
        throw new Error("Frontmatter update failed");
      }

      const frontmatter = this.frontmatter.get(file);

      if (!frontmatter) {
        throw new Error(`Missing frontmatter: ${file.path}`);
      }

      update(frontmatter);
    },
    renameFile: async (file: TFile, path: string): Promise<void> => {
      this.renameCount += 1;

      if (this.failNextRename) {
        this.failNextRename = false;
        throw new Error("Rename failed");
      }

      if (this.files.has(normalizePath(path))) {
        throw new Error(`File already exists: ${path}`);
      }

      this.moveFile(file, path);
    },
  };

  addFolder(path: string): TFolder {
    const normalized = normalizePath(path);
    const existing = this.files.get(normalized);

    if (existing instanceof TFolder) {
      return existing;
    }

    const parentPath = normalized.includes("/")
      ? normalized.slice(0, normalized.lastIndexOf("/"))
      : "/";
    const parent = this.addFolder(parentPath);
    const folder = new TFolder(normalized, parent);
    parent.children.push(folder);
    this.files.set(normalized, folder);

    return folder;
  }

  addFile(path: string, frontmatter: Frontmatter, content = ""): TFile {
    const normalized = normalizePath(path);
    const separatorIndex = normalized.lastIndexOf("/");
    const parentPath = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : "/";
    const parent = this.addFolder(parentPath);
    const file = new TFile(normalized, parent);
    parent.children.push(file);
    this.files.set(normalized, file);
    this.frontmatter.set(file, frontmatter);
    this.contents.set(file, content);

    return file;
  }

  private moveFile(file: TFile, path: string): void {
    const normalized = normalizePath(path);
    const separatorIndex = normalized.lastIndexOf("/");
    const parentPath = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : "/";
    const parent = this.addFolder(parentPath);

    this.files.delete(file.path);
    const previousIndex = file.parent?.children.indexOf(file) ?? -1;

    if (previousIndex >= 0) {
      file.parent?.children.splice(previousIndex, 1);
    }

    file.path = normalized;
    file.name = normalized.split("/").at(-1) ?? "";
    const dotIndex = file.name.lastIndexOf(".");
    file.extension = dotIndex >= 0 ? file.name.slice(dotIndex + 1) : "";
    file.basename = dotIndex >= 0 ? file.name.slice(0, dotIndex) : file.name;
    file.parent = parent;
    parent.children.push(file);
    this.files.set(normalized, file);
  }
}

export { FakeApp as App };
