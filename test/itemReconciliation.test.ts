import type { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { ItemReconciliationQueue } from "../src/data/itemReconciliation";
import type { ReconcileTrigger } from "../src/data/itemMutations";
import { FakeApp } from "./obsidian";

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });

  return { promise, resolve };
}

function asFile(file: import("./obsidian").TFile): TFile {
  return file as unknown as TFile;
}

describe("ItemReconciliationQueue", () => {
  it("serializes reconciliation requests for the same file", async () => {
    const app = new FakeApp();
    const file = asFile(app.addFile("Notes/Note.md", {}));
    const first = deferred();
    const calls: ReconcileTrigger[] = [];
    const reconcile = vi.fn(async (_file: TFile, trigger: ReconcileTrigger) => {
      calls.push(trigger);

      if (trigger === "name") {
        await first.promise;
      }
    });
    const queue = new ItemReconciliationQueue(() => false, reconcile);

    const name = queue.enqueue(file, "name");
    const frontmatter = queue.enqueue(file, "frontmatter");
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toEqual(["name"]);
    first.resolve();
    await Promise.all([name, frontmatter]);
    expect(calls).toEqual(["name", "frontmatter"]);
  });

  it("allows different files to reconcile concurrently", async () => {
    const app = new FakeApp();
    const firstFile = asFile(app.addFile("Notes/First.md", {}));
    const secondFile = asFile(app.addFile("Notes/Second.md", {}));
    const first = deferred();
    const calls: string[] = [];
    const queue = new ItemReconciliationQueue(
      () => false,
      async (file) => {
        calls.push(file.path);

        if (file === firstFile) {
          await first.promise;
        }
      },
    );

    const firstRequest = queue.enqueue(firstFile, "name");
    const secondRequest = queue.enqueue(secondFile, "frontmatter");
    await secondRequest;

    expect(calls).toEqual(["Notes/First.md", "Notes/Second.md"]);
    first.resolve();
    await firstRequest;
  });

  it("continues processing after a rejected request", async () => {
    const app = new FakeApp();
    const file = asFile(app.addFile("Notes/Note.md", {}));
    const reconcile = vi.fn()
      .mockRejectedValueOnce(new Error("Failed"))
      .mockResolvedValueOnce(undefined);
    const queue = new ItemReconciliationQueue(() => false, reconcile);

    const failed = queue.enqueue(file, "name");
    const recovered = queue.enqueue(file, "frontmatter");

    await expect(failed).rejects.toThrow("Failed");
    await expect(recovered).resolves.toBeUndefined();
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it("skips a queued request if migration starts before execution", async () => {
    const app = new FakeApp();
    const file = asFile(app.addFile("Notes/Note.md", {}));
    const first = deferred();
    const started = deferred();
    let paused = false;
    const reconcile = vi.fn(async (_file: TFile, trigger: ReconcileTrigger) => {
      if (trigger === "name") {
        started.resolve();
        await first.promise;
      }
    });
    const queue = new ItemReconciliationQueue(() => paused, reconcile);

    const running = queue.enqueue(file, "name");
    const queued = queue.enqueue(file, "frontmatter");
    await started.promise;
    paused = true;
    first.resolve();
    await Promise.all([running, queued]);

    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("keeps the same queue when the file path changes", async () => {
    const app = new FakeApp();
    const runtimeFile = app.addFile("Notes/Old.md", {});
    const file = asFile(runtimeFile);
    const first = deferred();
    const started = deferred();
    const paths: string[] = [];
    const queue = new ItemReconciliationQueue(
      () => false,
      async (current, trigger) => {
        paths.push(current.path);

        if (trigger === "name") {
          started.resolve();
          await first.promise;
        }
      },
    );

    const running = queue.enqueue(file, "name");
    await started.promise;
    await app.fileManager.renameFile(runtimeFile, "Notes/New.md");
    const queued = queue.enqueue(file, "frontmatter");
    first.resolve();
    await Promise.all([running, queued]);

    expect(paths).toEqual(["Notes/Old.md", "Notes/New.md"]);
  });
});
