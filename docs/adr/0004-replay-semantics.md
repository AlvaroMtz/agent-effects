# ADR 0004: Replay Resolves from the Journal, Never Re-executes

- **Status:** Accepted
- **Date:** 2026-09-17

## Context

Replay is the first differentiated capability the roadmap commits to
(§0.0.3): given a journal from a real run, a replay runtime must reproduce
the run offline with zero external calls. The determinism claim must be
bounded (§2.4): the project does not promise that the whole agent is
deterministic — scheduling, model behavior, framework closures, external
concurrency, and wall clocks are all outside the boundary. It promises
exactly this: *given the same effects resolved with the same recorded
results, the replay runtime will not re-execute those side effects.*

The roadmap is explicit about wording (Risk 5, §18): never say "perfect
deterministic agent replay"; say **effect-level deterministic replay**. It
also sketches three future modes — `strict` (fail on unknown effects),
`passthrough` (replay known, execute new), `mock` (resolve unknown via
mocks) — with `strict` implemented first in `0.0.3`.

## Decision

1. Replay is **resolution from the journal**: for each requested effect ID,
   the replay runtime finds the recorded `EffectRequested` /
   `EffectResolved` pair and returns the recorded result. It never calls a
   real executor.
2. **`strict` mode is the first and default mode (0.0.3):** encountering an
   effect ID with no recorded resolution is a hard failure, surfacing
   mismatch detection as a feature.
3. **Wording is locked:** all documentation and marketing say
   "effect-level deterministic replay". The phrase "perfect deterministic
   agent replay" must not appear in project materials.
4. `passthrough` and `mock` modes are **deferred past 0.1.0**; the testing
   toolkit (§0.0.4, ADR-referenced mocks) covers offline mocking in the
   meantime.
5. Exit criteria carry over verbatim (§0.0.3): replay is 100% offline, no
   external calls, tests verify zero IO, and mismatches are detected.

## Options considered

- **Passthrough or mock-first replay.** Rejected as the initial mode: both
  silently mix recorded and fresh results, weakening the guarantee and
  making "zero IO" unverifiable; strict is the honest baseline.
- **Fuzzy or semantic matching of effects during replay** (resolving an
  unknown ID by finding a "similar" recorded effect). Rejected:
  unpredictable matching destroys the audit value and risks feeding an
  agent a result that was never requested.
- **Re-executing effects with cached-when-possible semantics.** Rejected:
  that is memoization of a live executor, not replay, and it re-introduces
  exactly the external nondeterminism the boundary exists to control.

## Consequences

**Positive**

- The headline demo (§23) is achievable and verifiable: a recorded
  weather-agent run replays with `external calls: 0`.
- Strict failure on unknown effects doubles as a regression detector when
  code under test changes its effect requests.
- The bounded wording keeps expectations honest and supports the §0.1.0
  "usable experimental core" narrative.

**Negative**

- Strict replay is brittle to any change in the effect sequence; forks and
  diffing (§9, §0.5.0) are the sanctioned ways to explore divergence.
- Two extra modes are owed later, with their own semantics to document.

**Neutral**

- Fork and diff build directly on journal resolution rather than new
  execution machinery.

## References

- Roadmap §2.4 (bounded determinism), §8 (replay exacto; future modes),
  §9 (forking), §16 (replay Definition of Done: offline, no API keys, no
  tool IO), §18 Risk 5 (misleading "replay" wording), §23 (weather demo),
  §0.0.3 (strict first, algorithm, exit criteria), §0.0.4 (testing toolkit).
- Related: ADR-0002 (identity keys replay), ADR-0003 (journal as source of
  truth), ADR-0007 (no exactly-once; replay is resolution, not re-execution).
