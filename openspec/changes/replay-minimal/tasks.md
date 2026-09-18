# Tasks — replay-minimal (0.0.3)

The roadmap's `0.0.3 — Replay mínimo`: the first differential capability.
Branch `feat/replay-minimal`, stacked on `feat/journal-formal` (PR #3),
which is itself stacked on `feat/portable-journal-semantics` (PR #2).

Strict TDD per work unit (`openspec/config.yaml`).

## Scope

| Deliverable | Source |
|-------------|--------|
| `createReplayRuntime({ journal })` | ROADMAP §0.0.3 |
| `strict` mode only | ADR-0004 §2; `passthrough` and `mock` are deferred past 0.1.0 |
| Resolution from the recorded request/resolution pair, never re-execution | ADR-0004 §1 |
| Mismatch detection | ROADMAP §0.0.3 exit criteria; ADR-0002 §2 allows a type+input fingerprint for diagnostics, never as identity |
| 100% offline, zero external calls, tests that verify it | ROADMAP §0.0.3 exit criteria |

Locked wording (ADR-0004 §3): this capability is **effect-level
deterministic replay**. The phrase "perfect deterministic agent replay"
must not appear anywhere.

## Contract gap this milestone must close

`EffectJournal` exposes `append` and `findResult` only, so a replay runtime
can read a recorded *result* but not the recorded *request*. ADR-0004 §1
states that replay finds the recorded `EffectRequested`/`EffectResolved`
pair, and ADR-0012 §2 put the whole effect in the request entry precisely so
it could be verified. The lookup is the missing half of an already accepted
decision, so it is added to the interface rather than worked around with a
backend-specific cast. No new ADR: this implements ADR-0004 §1.

## Work units

- [ ] 1. `EffectJournal.findRequest(runId, effectId)` in core, implemented by both backends.
  - Returns the recorded `Effect`, or `undefined` when the occurrence was never requested.
  - Both backends return a snapshot, like `findResult` (ADR-0012 §4).

- [ ] 2. `@agent-effects/replay` — `createReplayRuntime({ journal })`, hit path.
  - Implements core's `EffectRuntime`, so it is a drop-in replacement for the live runtime.
  - Takes **no executor**: an external call is not merely forbidden, it is unrepresentable.
  - A recorded resolution is returned unchanged.

- [ ] 3. Strict-mode failures.
  - `ReplayMissError`: the occurrence has no recorded request, or a request with no resolution.
  - `ReplayMismatchError`: the recorded request exists but the effect asked for differs in `type` or `input`.
  - Comparison is a canonical fingerprint over type and input, key order independent. It is diagnostic only and never identity (ADR-0002 §2).
  - Both are hard failures, not error results: a miss is a harness failure, not an outcome the agent produced.

- [ ] 4. Offline guarantees and the replay demo.
  - A test asserts the package's own sources import nothing from `node:*` and touch no network global, so "zero IO" is checked rather than asserted in prose.
  - A journal double counts its reads, so a replay that silently re-executed would be visible.
  - End-to-end: `fixtures/journal/basic-run.jsonl` replays to the same result stream it recorded.

- [ ] 5. Documentation.
  - `packages/replay/README.md` loses its stub status.
  - `docs/concepts/README.md` gains what replay is and what it refuses to do.

Deferred, explicitly not tasks here: `passthrough` and `mock` modes (past
0.1.0), the testing toolkit (0.0.4), adapters (0.0.5), fork and diff.
