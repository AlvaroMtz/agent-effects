# ADR 0003: Append-Only Journal as Source of Truth

- **Status:** Accepted
- **Date:** 2026-09-17

## Context

Everything the project promises — replay (§8), audit (§1), diffing (§0.5.0),
forking (§9), and observability projection (§0.6.0) — is only trustworthy if
there is a single, immutable record of what effects were requested and how
they resolved. The roadmap fixes this shape early: the journal is an
append-only sequence (§2.3), a first-class primitive with typed entries
(RunStarted, EffectRequested, EffectResolved, RunCompleted, RunFailed) and a
per-entry envelope of `sequence`, `timestamp`, and `runId` (§0.0.2), behind a
minimal `EffectJournal` interface (§5.4).

§0.0.2 also enumerates the invariants the format must guarantee, and §0.0.1
exits only when the hard persistence questions are answered: when entries are
written, and what happens when the journal or the result persistence fails.
Persistence backends beyond the reference ones are explicitly integrations —
Postgres is not in core (§16) — and the core stays small (§2.6).

## Decision

1. The journal is the **append-only source of truth** for a run. Entries are
   never mutated, reordered, or truncated; corrections happen by appending
   (for example, a forked run), never by rewriting history.
2. `sequence` is **strictly monotonic**, assigned at append time, and is the
   only ordering guarantee (causality is separate; see ADR-0006).
3. Entries are **JSON-canonical** (§2.5): portable fields are
   JSON-serializable, and every entry carries a `schemaVersion` (ADR-0009).
4. **Invariants** (§0.0.2), enforced by writers and validators:
   an `EffectResolved` entry requires a prior `EffectRequested` for the same
   effect; an `effectId` is unique within a run; `sequence` is monotonic;
   the journal is append-only.
5. Reference backends ship in this order: **in-memory (0.0.1)**, then
   **JSONL (0.0.2)**, chosen so that `cat run.jsonl` is useful to a human.
   SQL and durable-execution backends are integrations, not core.

## Options considered

- **Mutable database records as the primary model.** Rejected: updates and
  deletes destroy the audit trail and make replay results untrustworthy;
  every consumer would need to reason about current-vs-past state.
- **Event sourcing with snapshots and projections in core.** Rejected: the
  journal is deliberately the minimal primitive; snapshots arrive later as
  semantic checkpoints (§12, §0.7.0) and projections as exporters (§0.6.0).
- **Databases (SQLite/Postgres) as the first backend.** Rejected: violates
  §2.6 and §16; in-memory plus JSONL are sufficient references and keep the
  `0.0.1`/`0.0.2` milestones honest.

## Consequences

**Positive**

- One artifact serves replay, audit, diffing, forking, streaming, and manual
  inspection (§2.3).
- Invariants are checkable locally by any reader; corrupted or hand-edited
  journals are detectable.
- Backends are pluggable behind `EffectJournal` without touching semantics.

**Negative**

- Storage grows monotonically; long runs need size discipline and future
  archival strategies.
- Corrections are verbose — the honest history of attempts is recorded, not
  silently collapsed.

**Neutral**

- Journal failure behavior (e.g., executor completed but result could not be
  persisted) is governed by ADR-0005 and ADR-0007, not by this ADR.

## References

- Roadmap §2.3 (append-only journal), §5.4 (EffectJournal), §12 (semantic
  checkpoints), §16 (memory + JSONL as reference persistence; no Postgres in
  core), §0.0.1 exit criteria 4/6/7, §0.0.2 (JournalEntry, envelope,
  invariants, JSONL), §0.5.0 (diff reads journals).
- Related: ADR-0001 (events are journal facts), ADR-0002 (effect identity),
  ADR-0006 (sequence vs causality), ADR-0009 (schema versioning),
  ADR-0010 (sensitivity of stored data).
