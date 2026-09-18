import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Effect, ToolInvokeInput } from "@agent-effects/core";
import { JsonlEffectJournal } from "@agent-effects/journal-jsonl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReplayRuntime } from "./index.js";

const SRC = fileURLToPath(new URL(".", import.meta.url));
const FIXTURE = fileURLToPath(new URL("../../../fixtures/journal/basic-run.jsonl", import.meta.url));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("replay is offline by construction", () => {
  it("imports nothing that can reach the outside world", () => {
    // Checked rather than promised: the package's own sources must not pull
    // in a filesystem, a process or a network API. Test files are excluded --
    // this very test reads the disk.
    const sources = readdirSync(SRC).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
    );
    expect(sources.length).toBeGreaterThan(0);

    for (const name of sources) {
      const text = readFileSync(`${SRC}${name}`, "utf8");
      expect([name, /from "node:/.test(text)]).toEqual([name, false]);
      expect([name, /\b(fetch|XMLHttpRequest|WebSocket|require)\s*\(/.test(text)]).toEqual([
        name,
        false,
      ]);
    }
  });

  it("takes no executor, so there is no seam to execute through", () => {
    const journal = {
      append: vi.fn(),
      findRequest: vi.fn(),
      findResult: vi.fn(),
    };
    const replay = createReplayRuntime({ journal });

    // The runtime's whole surface is resolve; nothing accepts an executor.
    expect(Object.keys(replay)).toEqual(["resolve"]);
  });
});

describe("the recorded run replays with zero external calls", () => {
  it("returns the recorded result stream", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("replay must not reach the network");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const journal = await JsonlEffectJournal.open(FIXTURE);
    const replay = createReplayRuntime({ journal });

    const recorded = journal
      .entries("run_1")
      .filter((entry) => entry.kind === "effect.requested")
      .map((entry) => (entry.kind === "effect.requested" ? entry.effect : undefined))
      .filter((effect): effect is Effect => effect !== undefined);

    expect(recorded.map((effect) => effect.type)).toEqual(["tool.invoke", "model.invoke"]);

    const results = [];
    for (const effect of recorded) {
      results.push(await replay.resolve(effect));
    }

    expect(results).toEqual([
      { effectId: "fx_1", status: "ok", output: { temperature: 24, summary: "sunny" } },
      { effectId: "fx_2", status: "ok", output: "Madrid stays sunny all week." },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses an effect the recorded run never contained", async () => {
    const journal = await JsonlEffectJournal.open(FIXTURE);
    const replay = createReplayRuntime({ journal });

    const unrecorded: Effect<ToolInvokeInput> = {
      id: "fx_9",
      runId: "run_1",
      type: "tool.invoke",
      input: { tool: "weather", arguments: { city: "Madrid" } },
    };

    // A replay that invented an answer here would be worse than useless.
    await expect(replay.resolve(unrecorded)).rejects.toMatchObject({
      reason: "no-recorded-request",
    });
  });

  it("reports a diverged run instead of resolving it", async () => {
    const journal = await JsonlEffectJournal.open(FIXTURE);
    const replay = createReplayRuntime({ journal });

    const diverged: Effect<ToolInvokeInput> = {
      id: "fx_1",
      runId: "run_1",
      type: "tool.invoke",
      input: { tool: "weather", arguments: { city: "Barcelona" } },
    };

    await expect(replay.resolve(diverged)).rejects.toMatchObject({ field: "input" });
  });
});
