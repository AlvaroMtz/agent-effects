# ADR 0002: Effect Identity

- **Status:** Accepted
- **Date:** 2026-09-17

## Context

An effect must carry a stable identity so the journal, the replay runtime,
forks, and diagnostics can all refer to the same logical occurrence. The
roadmap (§7) flags identity as one of the most important early decisions and
fixes one half of it: identity is not equivalence. Two effects with identical
type and input — `tool.invoke("weather", "Madrid")` twice — are two distinct
decisions of the agent and must not collapse into one. Therefore
**ID ≠ content hash**; the ID identifies the logical occurrence.

Roadmap §24 leaves two identity questions open before `0.1.0`: who assigns
the ID (agent adapter or runtime), and how identity relates to replay lookup
(§8 resolves `fx_42` by searching its `effect.requested` /
`effect.resolved` pair). Fork overrides (§9) also key on effect IDs
(`overrides: { fx_17: alternateResult }`), so identity must be stable and
addressable per run.

## Decision

1. `Effect.id` is a **producer-assigned, opaque string**, unique within a
   run. It identifies the logical occurrence of an intentional request.
2. Identity is **never derived from content**. A type+input fingerprint may
   be computed for mismatch diagnostics during replay, but it is never used
   as identity and is not part of the portable identity contract.
3. **Replay, fork overrides, and journal lookups key on `Effect.id`.**
4. Recommended format: `fx_` prefix followed by a ULID or UUID. The format
   is a recommendation, not a validation rule, because the ID is opaque.
5. **The ID is required at the boundary.** The producer (agent code or
   adapter) assigns it before submission; the runtime rejects an effect
   without an ID as an `invalid-request` (ADR-0005) and validates uniqueness
   within a run. The ID is always fixed before the first journal write.

## Options considered

- **Content-hash identity.** Rejected: identical calls to the same tool can
  be two separate decisions; hashing merges them, breaking replay fidelity,
  fork overrides, and audit of how many times the agent chose to act.
- **Runtime-assigned sequential IDs only.** Rejected: producers need a
  stable reference to the effect before resolution (e.g., to name an
  override or link a retry); forcing runtime-only assignment creates a
  coordination step at the worst moment.
- **Composite keys (runId + type + input + counter).** Rejected: complex,
  leaks structure into what should be opaque, and still needs a counter —
  at which point a simple unique ID is strictly better.

## Consequences

**Positive**

- Replay (§8) and fork overrides (§9) reduce to simple ID lookups.
- Equivalent-but-distinct occurrences remain distinct and auditable.
- Diagnostics still catch accidental re-execution of a *different* effect
  where a fingerprint mismatch is informative.

**Negative**

- Producers must follow assignment discipline; duplicate IDs within a run
  are a journal invariant violation (ADR-0003) and surface as errors.
- Opaque IDs are not human-guessable; humans reading a journal rely on the
  surrounding entry fields for orientation.

**Neutral**

- The `fx_` prefix is convention, not contract; cross-run ID collisions are
  harmless because identity is scoped per run.

## References

- Roadmap §5.1 (Effect interface with `id`), §7 (identity vs equivalence,
  ID ≠ content hash), §8 (replay by effect ID), §9 (fork overrides by ID),
  §24 (open question: who assigns IDs; recommendation adopted),
  §0.0.1 exit criterion 3 (who generates the ID).
- Related: ADR-0001 (effects as requests), ADR-0003 (journal invariants),
  ADR-0004 (replay resolves by ID), ADR-0005 (retries get fresh IDs).
