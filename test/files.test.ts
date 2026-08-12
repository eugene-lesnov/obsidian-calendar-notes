import type { App } from "obsidian";
import { describe, expect, it } from "vitest";

import {
  makeUniquePath,
  replaceForbiddenChars,
  sanitizeFileName,
} from "../src/data/fileNames";
import { ensureFolder, joinPath } from "../src/data/folders";
import { buildDayIdentifier, readTemplateParts } from "../src/data/templates";
import { createSettings } from "./fixtures";
import { FakeApp, TFolder } from "./obsidian";

describe("folder and filename utilities", () => {
  it("joins normalized safe path segments", () => {
    expect(joinPath(" /Area/ ", "./Nested", "..", "Task.md"))
      .toBe("Area/Nested/Task.md");
    expect(joinPath("\\Area\\Nested")).toBe("Area/Nested");
  });

  it("creates nested folders idempotently", async () => {
    const app = new FakeApp();
    const folder = await ensureFolder(app as unknown as App, "Area/Nested");
    expect(folder).toBeInstanceOf(TFolder);
    expect(folder.path).toBe("Area/Nested");
    expect(await ensureFolder(app as unknown as App, "Area/Nested")).toBe(folder);
    expect(await ensureFolder(app as unknown as App, "/")).toBe(app.root);
  });

  it("rejects a file that blocks folder creation", async () => {
    const app = new FakeApp();
    app.addFile("Area", {});
    await expect(ensureFolder(app as unknown as App, "Area/Nested")).rejects.toThrow(
      "Path is not a folder",
    );
  });

  it("sanitizes names and allocates the first available path", () => {
    const app = new FakeApp();
    expect(replaceForbiddenChars("A/B:C")).toBe("A-B-C");
    expect(sanitizeFileName(" A?B ")).toBe("A-B");
    expect(makeUniquePath(app as unknown as App, "Active", "Task"))
      .toBe("Active/Task.md");
    app.addFile("Active/Task.md", {});
    app.addFile("Active/Task (2).md", {});
    expect(makeUniquePath(app as unknown as App, "Active", "Task"))
      .toBe("Active/Task (3).md");
  });
});

describe("templates", () => {
  it("formats day identifiers using settings", () => {
    expect(buildDayIdentifier("2026-08-12", createSettings({ dateFormat: "DD.MM.YYYY" })))
      .toBe("12.08.2026");
  });

  it("reads template body and copies cached frontmatter", async () => {
    const app = new FakeApp();
    const frontmatter = { tag: "template" };
    app.addFile(
      "Templates/Task.md",
      frontmatter,
      "---\n{\"tag\":\"template\"}\n---\nBody\n",
    );

    const parts = await readTemplateParts(app as unknown as App, "Templates/Task");
    expect(parts).toEqual({ body: "Body\n", frontmatter });
    expect(parts?.frontmatter).not.toBe(frontmatter);
    expect(await readTemplateParts(app as unknown as App, "Missing")).toBeNull();
    expect(await readTemplateParts(app as unknown as App, " ")).toBeNull();
  });
});
