import type { Effect, EffectJournal, EffectResult, JournalEntryDraft, ToolInvokeInput } from "@agent-effects/core";
import { describe, expect, it } from "vitest";
import { createReplayRuntime, ReplayMismatchError, ReplayMissError } from "./index.js";

const RUN = "run_1";

const weather: Effect<ToolInvokeInput> = {
  id: "fx_1",
  runId: RUN,
  type: "tool.invoke",
  input: { tool: "weather", arguments: { city: "Madrid" } },
};

const recordedResult: EffectResult = {
  effectId: "fx_1",
  status: "ok",
  output: { temperature: 24 },
};

/**
 * A journal that only ever answers lookups, and counts them. Replay must
 * never append, and must never reach anything but these two questions.
 */
class RecordedJournal implements EffectJournal {
  reads = 0;
  appends = 0;
  readonly #requests = new Map<string, Effect>();
  readonly #results = new Map<string, EffectResult>();

  constructor(entries: { effect: Effect; result?: EffectResult }[]) {
    for (const { effect, result } of entries) {
      this.#requests.set(`${effect.runId}/${effect.id}`, effect);
      if (result) {
        this.#results.set(`${effect.runId}/${effect.id}`, result);
      }
    }
  }

  async append(_entry: JournalEntryDraft): Promise<void> {
    this.appends += 1;
  }

  async findRequest(runId: string, effectId: string): Promise<Effect | undefined> {
    this.reads += 1;
    return this.#requests.get(`${runId}/${effectId}`);
  }

  async findResult(runId: string, effectId: string): Promise<EffectResult | undefined> {
    this.reads += 1;
    return this.#results.get(`${runId}/${effectId}`);
  }
}

describe("createReplayRuntime", () => {
  it("returns the recorded result without executing anything", async () => {
    const journal = new RecordedJournal([{ effect: weather, result: recordedResult }]);
    const replay = createReplayRuntime({ journal });

    await expect(replay.resolve(weather)).resolves.toEqual(recordedResult);
    // Replay reads; it never writes. A recorded run is not re-journaled.
    expect(journal.appends).toBe(0);
    expect(journal.reads).toBeGreaterThan(0);
  });

  it("matches effects regardless of key order in the input", async () => {
    const journal = new RecordedJournal([{ effect: weather, result: recordedResult }]);
    const replay = createReplayRuntime({ journal });

    // The same request serialized differently is the same request.
    const reordered: Effect<ToolInvokeInput> = {
      runId: RUN,
      id: "fx_1",
      input: { arguments: { city: "Madrid" }, tool: "weather" },
      type: "tool.invoke",
    };
    await expect(replay.resolve(reordered)).resolves.toEqual(recordedResult);
  });

  it("fails when the occurrence was never recorded", async () => {
    const journal = new RecordedJournal([]);
    const replay = createReplayRuntime({ journal });

    await expect(replay.resolve(weather)).rejects.toBeInstanceOf(ReplayMissError);
    await expect(replay.resolve(weather)).rejects.toMatchObject({
      reason: "no-recorded-request",
      runId: RUN,
      effectId: "fx_1",
    });
  });

  it("fails when the recorded occurrence never resolved", async () => {
    const journal = new RecordedJournal([{ effect: weather }]);
    const replay = createReplayRuntime({ journal });

    // strict mode: an unresolved occurrence is a hard failure, not a
    // silent re-execution (ADR-0004 §2).
    await expect(replay.resolve(weather)).rejects.toMatchObject({
      reason: "no-recorded-resolution",
    });
  });

  it("detects an effect that differs from the one recorded", async () => {
    const journal = new RecordedJournal([{ effect: weather, result: recordedResult }]);
    const replay = createReplayRuntime({ journal });

    const lisbon: Effect<ToolInvokeInput> = {
      ...weather,
      input: { tool: "weather", arguments: { city: "Lisbon" } },
    };

    await expect(replay.resolve(lisbon)).rejects.toBeInstanceOf(ReplayMismatchError);
    try {
      await replay.resolve(lisbon);
    } catch (error) {
      // The report has to say what changed, or a mismatch is unactionable.
      expect((error as Error).message).toContain("fx_1");
      expect(error).toMatchObject({ field: "input" });
    }
  });

  it("detects a changed effect kind", async () => {
    const journal = new RecordedJournal([{ effect: weather, result: recordedResult }]);
    const replay = createReplayRuntime({ journal });

    await expect(
      replay.resolve({ ...weather, type: "model.invoke", input: weather.input }),
    ).rejects.toMatchObject({ field: "type" });
  });

  it("ignores metadata when matching", async () => {
    const journal = new RecordedJournal([{ effect: weather, result: recordedResult }]);
    const replay = createReplayRuntime({ journal });

    // Adapter metadata is not part of the portable contract the agent asked
    // for (ADR-0008), so it cannot make a replay fail.
    await expect(
      replay.resolve({ ...weather, metadata: { "adapter.openai.call_id": "call_9" } }),
    ).resolves.toEqual(recordedResult);
  });

  it("rejects an effect with no usable id before any lookup", async () => {
    const journal = new RecordedJournal([]);
    const replay = createReplayRuntime({ journal });

    await expect(replay.resolve({ ...weather, id: "  " })).rejects.toBeInstanceOf(ReplayMissError);
    expect(journal.reads).toBe(0);
  });
});
