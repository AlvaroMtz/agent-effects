import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Effect, ToolInvokeInput } from "@agent-effects/core";
import { beforeEach, describe, expect, it } from "vitest";
import { JsonlEffectJournal } from "./index.js";

const RUN = "run_1";

const weather: Effect<ToolInvokeInput> = {
  id: "fx_1",
  runId: RUN,
  type: "tool.invoke",
  input: { tool: "weather", arguments: { city: "Madrid" } },
};

function requested(runId: string, effectId: string) {
  return {
    kind: "effect.requested" as const,
    runId,
    effect: structuredClone({ ...weather, id: effectId, runId }),
  };
}

let path: string;

beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-effects-"));
  path = join(dir, "run.jsonl");
});

describe("JsonlEffectJournal", () => {
  it("writes one entry per line, readable with cat", async () => {
    const journal = await JsonlEffectJournal.open(path);
    await journal.append(requested(RUN, "fx_1"));
    await journal.append({
      kind: "effect.resolved",
      runId: RUN,
      effectId: "fx_1",
      result: { effectId: "fx_1", status: "ok", output: { temperature: 24 } },
    });

    const lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({
      kind: "effect.requested",
      runId: RUN,
      sequence: 1,
      schemaVersion: "1.0",
      effect: { id: "fx_1", input: { tool: "weather", arguments: { city: "Madrid" } } },
    });
    expect(JSON.parse(lines[1])).toMatchObject({ kind: "effect.resolved", sequence: 2 });
  });

  it("reopens an existing journal and keeps counting", async () => {
    const first = await JsonlEffectJournal.open(path);
    await first.append(requested(RUN, "fx_1"));

    // A new process attaches to the same file: sequences continue and the
    // recorded history is still addressable.
    const second = await JsonlEffectJournal.open(path);
    await second.append({
      kind: "effect.resolved",
      runId: RUN,
      effectId: "fx_1",
      result: { effectId: "fx_1", status: "ok", output: "sunny" },
    });

    await expect(second.findResult(RUN, "fx_1")).resolves.toMatchObject({ output: "sunny" });
    expect(second.entries(RUN).map((entry) => entry.sequence)).toEqual([1, 2]);
  });

  it("enforces the same invariants as any other writer", async () => {
    const journal = await JsonlEffectJournal.open(path);
    await journal.append(requested(RUN, "fx_1"));

    await expect(journal.append(requested(RUN, "fx_1"))).rejects.toMatchObject({
      code: "duplicate-effect-id",
    });
    await expect(
      journal.append({
        kind: "effect.resolved",
        runId: RUN,
        effectId: "fx_2",
        result: { effectId: "fx_2", status: "ok", output: "x" },
      }),
    ).rejects.toMatchObject({ code: "missing-request" });

    // A rejected append writes nothing.
    const lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
  });

  it("holds many runs in one file", async () => {
    const journal = await JsonlEffectJournal.open(path);
    for (const runId of ["run_A", "run_B"]) {
      await journal.append(requested(runId, "fx_1"));
      await journal.append({
        kind: "effect.resolved",
        runId,
        effectId: "fx_1",
        result: { effectId: "fx_1", status: "ok", output: runId },
      });
    }

    await expect(journal.findResult("run_A", "fx_1")).resolves.toMatchObject({ output: "run_A" });
    await expect(journal.findResult("run_B", "fx_1")).resolves.toMatchObject({ output: "run_B" });
    // Sequences are per run, not per file.
    expect(journal.entries("run_B").map((entry) => entry.sequence)).toEqual([1, 2]);
  });

  it("refuses to attach to a journal it cannot read", async () => {
    await writeFile(path, '{"kind":"run.started"}\n', "utf8");

    await expect(JsonlEffectJournal.open(path)).rejects.toMatchObject({
      code: "invalid-entry",
      line: 1,
    });
  });
});
