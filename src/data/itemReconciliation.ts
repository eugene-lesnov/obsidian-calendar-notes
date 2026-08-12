import type { TFile } from "obsidian";

import type { ReconcileTrigger } from "./itemMutations";

export class ItemReconciliationQueue {
  private readonly queues = new WeakMap<TFile, Promise<void>>();

  constructor(
    private readonly isPaused: () => boolean,
    private readonly reconcile: (file: TFile, trigger: ReconcileTrigger) => Promise<void>,
  ) {}

  enqueue(file: TFile, trigger: ReconcileTrigger): Promise<void> {
    const previous = this.queues.get(file) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        if (this.isPaused()) {
          return;
        }

        await this.reconcile(file, trigger);
      });

    this.queues.set(file, next);

    return next;
  }
}
