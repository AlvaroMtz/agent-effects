# ADR 0006: Ordering and Concurrency — Sequence versus Causality

- **Status:** Accepted
- **Date:** 2026-09-17

## Context

Agents issue effects in parallel — one decision fanning out to several tool
invocations (§0.0.8) — and parallel completion order is nondeterministic.
A journal that implied causality from entry order would make two runs of the
same logic produce differently "shaped" histories, breaking the comparability
that diffing (§0.5.0), forking (§9), and cross-language conformance fixtures
(§0.11.0) depend on. §0.0.8 states the requirement directly: the journal must
not depend on completion order to represent causality, and it lists Lamport
clocks, monotonic sequence, causal graphs, and logical timestamps as
investigation candidates — while warning not to add distributed complexity
unless necessary. §24 repeats the open question for parallel tools.

The core `Effect` interface already carries `parentEffectId?` (§5.1), giving
an explicit edge for causal relationships without any clock machinery.

## Decision

1. **`sequence` records append order only.** It is a per-run, strictly
   monotonic counter used for storage and stable reads; it never encodes and
   must never be interpreted as causality, importance, or logical time.
2. **Causality is explicit:** `parentEffectId` links an effect to the effect
   that caused it (including nested `agent.invoke` children), and `retryOf`
   (ADR-0005) links retry attempts. Readers reconstruct the causal graph from
   these edges, not from ordering.
3. **No logical clocks (Lamport, vector) in core for 0.x.** If a concrete
   cross-runtime or distributed need emerges later, it can be introduced
   additively under ADR-0009 without reinterpreting `sequence`.

## Options considered

- **Lamport/vector clocks as core fields.** Rejected: they add distributed
  systems complexity that §0.0.8 explicitly warns against, force every
  producer (including adapters in other languages) to implement them, and
  solve a problem the project does not have while everything lives behind a
  single-runtime boundary.
- **Deriving causality from completion order in the journal.** Rejected:
  completion order varies run to run; two equivalent runs would diff as
  divergent, defeating §0.5.0 and §0.11.0.
- **Wall-clock timestamps for ordering.** Rejected: clocks skew and tick
  independently of cause; timestamps stay in the envelope (§0.0.2) as
  diagnostics, never as semantics.

## Consequences

**Positive**

- Journals from parallel or differently-timed runs remain structurally
  comparable; diffs reflect semantic divergence, not scheduling noise.
- The schema stays small; producing a valid journal in any language requires
  only a counter and two optional link fields.
- Causal queries (children of an effect, retry chains, fork ancestry) are
  simple graph walks.

**Negative**

- Producers must correctly populate `parentEffectId`/`retryOf`; effects
  written without an edge are indistinguishable from root effects.
- Concurrency *control* (limits, racing, cancellation of siblings) remains
  the caller's concern; the journal only records what happened.

**Neutral**

- The causal graph may contain roots and orphaned links; validators flag,
  but do not reject, unusual topologies.

## References

- Roadmap §5.1 (`parentEffectId`), §9 (fork ancestry), §18 Risk 4 (boundary
  discipline), §24 (parallel tools; nested agents via `parentEffectId`),
  §0.0.8 (concurrency goal, candidates, warning), §0.5.0 (diff),
  §0.11.0 (cross-language fixtures), §0.0.2 (sequence in envelope).
- Related: ADR-0003 (append-only, monotonic sequence),
  ADR-0005 (retryOf links), ADR-0009 (additive evolution path).
