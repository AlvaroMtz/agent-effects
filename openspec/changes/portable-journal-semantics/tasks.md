# Tasks — portable-journal-semantics (0.0.2)

Hardens the 0.0.1 core contract before replay and JSONL persistence land.
Source: a review document proposing six changes, assessed against the
shipped 0.0.1 code and the accepted ADRs. Branch:
`feat/portable-journal-semantics`, stacked on
`feat/minimal-effect-semantics-1b` while PR #1 is open, because `main`
holds only the initial commit.

Strict TDD (`openspec/config.yaml`) applies per work unit:
RED → GREEN → TRIANGULATE → REFACTOR, binding command `pnpm -r test`.

## Accepted

| # | Change | Why it is real |
|---|--------|----------------|
| 1 | `effect.requested` carries the full `Effect` | The entry records only `effectId`, so nothing can reconstruct what was attempted; ADR-0004 replay and its 0.0.3 mismatch detection are impossible without it |
| 2 | Lookup is scoped by `(runId, effectId)` | `findResult(effectId)` scans every run; ADR-0002 already scopes identity per run, so the interface, not the ADR, is wrong. The "one journal per run" convention in design §14 is the workaround this removes |
| 3 | Executors return `ExecutionOutcome`; the runtime owns `EffectResult` | The runtime returns the executor's result verbatim without checking `result.effectId === effect.id`, so an executor can resolve `fx_1` and report `fx_999` |
| 4a | `Effect.input` and outcome `output` are `JsonValue` | The spec forbids functions, sockets and class instances in the portable contract; `TInput = unknown` does not enforce it, and snapshot-on-write depends on it |
| 5 | Journal snapshots entries on write and on read | `append` spreads shallowly and `entries()` returns the live array; `readonly` is shallow in TypeScript, so callers can rewrite recorded history |
| — | No duplicate `effect.resolved` per `(runId, effectId)` | Invariant I4 of the review; the writer enforces the other two but not this one |

## Rejected, with reasons

| # | Change | Why not |
|---|--------|---------|
| 6 | Reduce `EffectResult` to `ok`/`error`/`unknown` | ADR-0005 ships all six states from day one precisely to avoid this breaking change. Change 3 already removes the problem: an executor that can only return `ok`/`error` cannot produce `pending`, `cancelled` or `denied` |
| — | Redefine `SerializableError` as `{name, message, code?, stack?, data?}` | ADR-0005 fixes the field set and the spec requires a stable `code`; the proposal makes it optional, and `stack` puts execution traces into a journal ADR-0010 declares sensitive by default |
| — | `Effect<TType extends string>` | Contradicts the in-scope-kinds requirement and AC3: exactly two kinds are dispatchable |
| — | Create `docs/adr/` with ten new ADRs | The directory exists with ten accepted ADRs; the proposed numbering collides with 0003 and 0004 |

## Work units

- [ ] 1. ADR-0011 and ADR-0012 (docs only; no code).
  - ADR-0011 — executors return an execution outcome, the runtime owns the result.
  - ADR-0012 — journal entries are run-scoped, self-contained and immutable to callers (covers changes 1, 2, 5 and invariant I4).
  - Update `docs/adr/README.md` index, and the Status lines of ADR-0002 and ADR-0003 to point at their successors. The ADR process forbids editing an accepted decision in place.
  - Check: both files follow the Nygard sections used by 0001–0010; the index lists twelve rows.

- [ ] 2. `JsonValue` on the portable contract (change 4a).
  - `Effect<TInput extends JsonValue = JsonValue>`; `metadata` unchanged.
  - RED: an effect whose input holds a function stops typechecking.
  - Check: `pnpm -r typecheck` green; the two in-scope kinds still typecheck.

- [ ] 3. `ExecutionOutcome` and runtime-owned results (change 3).
  - New `execution-outcome.ts`: `ExecutionOutcome = ExecutionSuccess | ExecutionFailure`, no `effectId`.
  - `EffectExecutor.execute` returns `Promise<ExecutionOutcome>`; the runtime stamps `effectId` from `effect.id`.
  - RED: an executor reporting a foreign id cannot reach the recorded result.
  - Check: deviation 13 of 0.0.1 disappears — a non-terminal executor result is now unrepresentable.

- [ ] 4. Run-scoped lookup (change 2).
  - `EffectJournal.findResult(runId, effectId)`; `MemoryEffectJournal` keys per run.
  - RED: `run_A/fx_1` and `run_B/fx_1` coexist and resolve independently.
  - Check: the "one journal instance per run" convention is deleted from code and docs.

- [ ] 5. Self-contained request entries (change 1).
  - `EffectRequestedEntry` carries `effect: Effect` instead of `effectId`; invariant `entry.runId === entry.effect.runId`.
  - RED: the recorded request reconstructs type, input and metadata.

- [ ] 6. Snapshot on write and read, plus invariant I4 (change 5).
  - `structuredClone` on append and on read; duplicate `effect.resolved` rejected.
  - RED: mutating the caller's effect after append, and mutating a read entry, both leave history intact.

- [ ] 7. Documentation.
  - `docs/concepts/README.md`: the new executor and journal contract.
  - `docs/migration/0.0.1-to-0.0.2.md`: the four breaking changes with before/after.
  - Check: no stale `findResult(effectId)` or executor-returns-`EffectResult` wording remains.

Deferred, explicitly not tasks here: replay runtime (0.0.3), JSONL backend,
JSON Schema publication, `run.failed` entries, policy, adapters.
