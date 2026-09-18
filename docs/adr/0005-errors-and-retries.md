# ADR 0005: Serializable Errors and Retry Semantics

- **Status:** Accepted — the executor seam is narrowed by [ADR-0011](0011-execution-outcome.md); the six-state result model stands
- **Date:** 2026-09-17

## Context

Effects fail in more than one way, and the roadmap insists on distinguishing
the failure sites before the project grows (§0.0.7): effect *request* failed,
effect *execution* failed, effect *result persistence* failed, *run* failed,
effect *cancelled*. Naive `ok`/`error` outcomes hide crash-recovery reality:
an external API may have accepted a request even though the process died
before persisting the result (Risk 6, §18; scenario B of §0.14.0). §19
therefore recommends six resolution states — `ok`, `error`, `cancelled`,
`denied`, `pending`, `unknown` — with `unknown` called out as essential for
crash recovery.

§0.0.7 also mandates an ADR for retries: either attempts are recorded on the
same effect (`fx_12 attempt 1 → error`, `attempt 2 → ok`) or each attempt is
an independent effect, and the choice must be explicit. §24 lists the same
question as an open research item. Errors must cross the portable boundary,
so native exceptions and framework classes are not an option (§2.5).

## Decision

1. The portable error shape is
   **`SerializableError { code, message, details?, retryable? }`**.
   `code` is a stable, stringly-typed category; `retryable` is advisory.
2. **Failure sites are distinguished** in codes and journal facts:
   `policy-denied`, `invalid-request`, `execution-failed`,
   `persistence-failed`, `run-failed`, `cancelled`.
3. **Resolution states** for an effect are
   `ok | error | pending | cancelled | denied | unknown` (§19). `pending`
   covers requested-but-unresolved effects (e.g., suspension awaiting human
   input, §0.3.0); `unknown` covers outcome-unverifiable occurrences.
4. **A retry is a new Effect with a fresh ID**, linked to its predecessor by
   a `retryOf` reference. Attempts are visible as a chain of distinct
   journal facts; nothing about an earlier attempt is overwritten.

## Options considered

- **Attempt counters on a single effect** (`fx_12`, `attempt: 2`). Rejected:
  it overloads one identity with several occurrences, complicating ADR-0002
  identity, replay lookups, and fork overrides, and it invites mutating the
  original resolution entry.
- **Throwing native exceptions across the boundary.** Rejected: exceptions
  are not JSON-serializable, carry framework-specific structure, and cannot
  round-trip through journals or cross-language fixtures (§0.11.0).
- **Only `ok`/`error` until later.** Rejected: §19 exists precisely because
  `unknown` cannot be retrofitted honestly once consumers build on two
  states; crash recovery needs it from the start of formal semantics.

## Consequences

**Positive**

- Journals answer "what happened, including every failed attempt" without
  guesswork; retry chains are auditable and diffable.
- `unknown` gives crash recovery an honest vocabulary instead of fake
  failures or silent success.
- Cross-language implementations only need to agree on a small serializable
  shape.

**Negative**

- Six states are more than the naive two; consumers must handle all of them,
  and journals grow with each attempt.
- `retryable` is advisory — downstream systems decide, and some will ignore it.

**Neutral**

- `idempotencyKey` support for retries is orthogonal and covered in
  ADR-0007; `attempt`-style counters may still appear as advisory metadata.

## References

- Roadmap §5.2 (EffectResult with SerializableError), §10 (policy denial is
  an outcome), §18 Risk 6 (unknown outcome), §19 (resolution states),
  §24 (retries open question), §0.0.7 (failure sites; retry ADR mandate),
  §0.3.0 (pending human effects), §0.14.0 (crash scenarios A/B),
  §2.5 (JSON-first).
- Related: ADR-0002 (fresh IDs per retry), ADR-0003 (append-only records
  attempts), ADR-0007 (exactly-once and idempotencyKey),
  ADR-0009 (versioned error schemas).
