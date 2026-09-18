# ADR 0012: Journal Entries Are Run-Scoped, Self-Contained, and Immutable to Callers

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Three gaps in the `0.0.1` journal surfaced while reviewing it against
replay (ADR-0004) and append-only semantics (ADR-0003).

**Lookup is not run-scoped.** `EffectJournal.findResult(effectId)` takes an
effect id alone, so a backend must treat effect ids as globally unique.
ADR-0002 scopes identity per run and states that cross-run id collisions
are harmless. The `0.0.1` in-memory backend papered over the gap with a
"one journal instance per run" convention; the convention exists only
because the interface asks the wrong question.

**Request entries are not self-contained.** `EffectRequestedEntry` records
`effectId` and nothing else. A journal that records *that* `fx_1` happened
but not *what* `fx_1` attempted cannot support replay resolution
(ADR-0004 §1), the mismatch detection `0.0.3` requires (ADR-0004 §2),
audit, diff, or a useful JSONL export.

**Stored history is mutable through shared references.** The in-memory
backend stores the caller's object with a shallow spread and hands the live
array back on read. TypeScript's `readonly` is shallow, so a caller can
rewrite a recorded payload after the fact. ADR-0003 §1 says entries are
never mutated; in `0.0.1` that holds by politeness, not by construction.

## Decision

1. **Journal addressing is `(runId, effectId)`.** `findResult` takes both.
   This refines ADR-0002 §3, which said lookups key on `Effect.id`; the
   effect id alone was never sufficient, as that same ADR's own
   cross-run note implies.
2. **`effect.requested` carries the whole `Effect`**, not just its id, with
   the invariant `entry.runId === entry.effect.runId`.
3. **Writers reject a second `effect.resolved`** for a `(runId, effectId)`
   that already has one. This joins the two invariants ADR-0003 §4 already
   mandates. Retries are new effects with fresh ids (ADR-0005), so a second
   resolution of the same occurrence is never legitimate.
4. **Entries are snapshotted on write and on read.** A backend stores a
   deep copy of what it was given and returns deep copies to readers, so
   neither the producer nor a reader can alter recorded history. This is
   viable because the portable contract is JSON-only (ADR-0003 §3), which
   is what makes a structural clone total.
5. `sequence`, `schemaVersion` and `timestamp` stay **writer-assigned**, as
   ADR-0003 §2 and ADR-0009 require. Callers hand the journal a draft
   entry and cannot forge those fields.

## Options considered

- **Keep `findResult(effectId)` and require one journal per run.**
  Rejected: an unenforceable convention that a single shared instance
  silently violates, and it makes a multi-run journal — which JSONL will
  be — unable to answer the lookup at all.
- **Store an effect fingerprint instead of the whole effect.** Rejected: a
  hash detects that something differs but cannot say what was attempted, so
  it serves mismatch detection and nothing else. ADR-0002 §2 also rules out
  using fingerprints as identity.
- **Freeze entries instead of cloning them.** Rejected: `Object.freeze` is
  shallow, and a deep freeze mutates the caller's own object as a side
  effect of appending it.
- **Document immutability and trust callers.** Rejected: the journal is the
  source of truth; "please do not edit the past" is not an invariant.

## Consequences

**Positive**

- Replay can locate a recorded request, verify the effect matches, and
  return the recorded result without executing anything.
- One journal can hold many runs, which is what a JSONL file is.
- Append-only becomes a property of the implementation rather than an
  expectation of its callers.

**Negative**

- Breaking change: `findResult` gains a parameter and the request entry
  changes shape. Both are mechanical to migrate and documented.
- Cloning costs time and memory proportional to payload size on every
  append and every read. Acceptable for the in-memory reference backend;
  a JSONL backend gets the same guarantee for free through serialization.

**Neutral**

- The `0.0.1` "one journal instance per run" convention is deleted rather
  than deprecated: nothing depended on it except the gap it hid.

## References

- Roadmap §7 (identity), §8 (replay by effect id), §25 (layout).
- Related: ADR-0002 (identity scoped per run; §3 refined here), ADR-0003
  (append-only, invariants; §4 extended here), ADR-0004 (replay resolves
  from the journal), ADR-0009 (schema versioning), ADR-0011 (the runtime
  owns the result recorded in a resolved entry).
