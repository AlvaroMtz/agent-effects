import { JournalInvariantError } from "@agent-effects/core";
import { describe, expect, it } from "vitest";
import { MemoryEffectJournal } from "./memory.js";

const RUN = "run_1";

describe("MemoryEffectJournal", () => {
  it("append effect.resolved without prior request rejects", async () => {
    const journal = new MemoryEffectJournal();

    await expect(
      journal.append({
        kind: "effect.resolved",
        runId: RUN,
        effectId: "fx_9",
        result: { effectId: "fx_9", status: "ok", output: "sunny, 24°C" },
      }),
    ).rejects.toThrow(JournalInvariantError);

    await expect(
      journal.append({
        kind: "effect.resolved",
        runId: RUN,
        effectId: "fx_9",
        result: { effectId: "fx_9", status: "ok", output: "sunny, 24°C" },
      }),
    ).rejects.toMatchObject({ code: "missing-request" });

    // The rejected entry is not recorded.
    expect(journal.entries(RUN)).toEqual([]);
  });

  it("append duplicate effect.requested rejects", async () => {
    const journal = new MemoryEffectJournal();
    await journal.append({ kind: "effect.requested", runId: RUN, effectId: "fx_1" });

    await expect(
      journal.append({ kind: "effect.requested", runId: RUN, effectId: "fx_1" }),
    ).rejects.toMatchObject({ code: "duplicate-effect-id" });

    expect(journal.entries(RUN)).toHaveLength(1);

    // Triangulation: the writer stays usable after a rejected duplicate.
    await journal.append({ kind: "effect.requested", runId: RUN, effectId: "fx_2" });
    expect(journal.entries(RUN).map((entry) => entry.sequence)).toEqual([1, 2]);
  });

  it("sequence increases with each append", async () => {
    const journal = new MemoryEffectJournal();

    // Triangulation: all four entry kinds appended in run-lifecycle order.
    await journal.append({ kind: "run.started", runId: RUN });
    await journal.append({ kind: "effect.requested", runId: RUN, effectId: "fx_1" });
    await journal.append({
      kind: "effect.resolved",
      runId: RUN,
      effectId: "fx_1",
      result: { effectId: "fx_1", status: "ok", output: "sunny, 24°C" },
    });
    await journal.append({ kind: "run.completed", runId: RUN });

    const entries = journal.entries(RUN);
    expect(entries.map((entry) => entry.kind)).toEqual([
      "run.started",
      "effect.requested",
      "effect.resolved",
      "run.completed",
    ]);
    expect(entries.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4]);

    // The counter is scoped per run, not global to the process.
    await journal.append({ kind: "run.started", runId: "run_2" });
    expect(journal.entries("run_2").map((entry) => entry.sequence)).toEqual([1]);
  });

  it("every entry carries schemaVersion at creation", async () => {
    const journal = new MemoryEffectJournal();
    await journal.append({ kind: "run.started", runId: RUN });
    await journal.append({ kind: "effect.requested", runId: RUN, effectId: "fx_1" });

    for (const entry of journal.entries(RUN)) {
      expect(entry.schemaVersion).toBe("1.0");
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
      expect(entry.runId).toBe(RUN);
    }
  });

  it("entries with secret-like values stored verbatim", async () => {
    const journal = new MemoryEffectJournal();
    const output = { apiKey: "sk-live-0123456789", password: "hunter2" };
    await journal.append({ kind: "effect.requested", runId: RUN, effectId: "fx_1" });
    await journal.append({
      kind: "effect.resolved",
      runId: RUN,
      effectId: "fx_1",
      result: { effectId: "fx_1", status: "ok", output },
    });

    const resolved = journal.entries(RUN)[1];
    expect(resolved).toMatchObject({ kind: "effect.resolved", result: { output } });
    // Triangulation: the same secret survives the lookup seam unredacted.
    await expect(journal.findResult(RUN, "fx_1")).resolves.toMatchObject({ output });
  });

  it("findResult returns full result from journal", async () => {
    const journal = new MemoryEffectJournal();
    const result = {
      effectId: "fx_1",
      status: "error",
      error: { code: "execution-failed", message: "provider unreachable", retryable: true },
    } as const;

    await journal.append({ kind: "effect.requested", runId: RUN, effectId: "fx_1" });
    await journal.append({ kind: "effect.resolved", runId: RUN, effectId: "fx_1", result });

    await expect(journal.findResult(RUN, "fx_1")).resolves.toEqual(result);
    // Absence is reported, never fabricated.
    await expect(journal.findResult(RUN, "fx_unknown")).resolves.toBeUndefined();
  });

  it("scopes lookup by run so an effect id can repeat across runs", async () => {
    const journal = new MemoryEffectJournal();
    for (const [runId, output] of [
      ["run_A", "sunny in A"],
      ["run_B", "raining in B"],
    ] as const) {
      await journal.append({ kind: "effect.requested", runId, effectId: "fx_1" });
      await journal.append({
        kind: "effect.resolved",
        runId,
        effectId: "fx_1",
        result: { effectId: "fx_1", status: "ok", output },
      });
    }

    // ADR-0002 scopes identity per run, so both occurrences are legitimate
    // and neither shadows the other.
    await expect(journal.findResult("run_A", "fx_1")).resolves.toMatchObject({
      output: "sunny in A",
    });
    await expect(journal.findResult("run_B", "fx_1")).resolves.toMatchObject({
      output: "raining in B",
    });
    await expect(journal.findResult("run_C", "fx_1")).resolves.toBeUndefined();
  });

  it("is process-local: a new instance starts empty", async () => {
    const first = new MemoryEffectJournal();
    await first.append({ kind: "effect.requested", runId: RUN, effectId: "fx_1" });

    const second = new MemoryEffectJournal();
    expect(second.entries(RUN)).toEqual([]);
    await expect(second.findResult(RUN, "fx_1")).resolves.toBeUndefined();
  });
});
