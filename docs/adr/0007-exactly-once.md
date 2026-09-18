# ADR 0007: No Exactly-Once Guarantee for External Side Effects

- **Status:** Accepted
- **Date:** 2026-09-17

## Context

The roadmap names the "exactly-once fantasy" as a core risk (Risk 6, §18):
an external API accepts a bank transfer, and the process dies before the
result is persisted. No journal design can retroactively make that outcome
certain. §0.14.0 formalizes the two crash scenarios — (A) effect requested,
process crashes (resolvable as `pending`), and (B) external effect executes,
process crashes before the result journal write — and mandates documenting
the sentence: *Effect runtime cannot guarantee exactly-once for arbitrary
external side effects.* §15 confirms that even `1.0.0` does not promise
exactly-once external effects, and §16 requires only memory + JSONL as
reference persistence, keeping durable execution at integration distance.
§19 makes `unknown` a first-class resolution state for exactly this gap.

Durable execution systems (Temporal, DBOS, Restate) exist and are named as
the right home for stronger guarantees (§4, §16).

## Decision

1. The runtime **does not promise exactly-once execution** of arbitrary
   external side effects, ever — including at `1.0.0`. The mandated
   disclosure sentence from §0.14.0 appears in the project documentation.
2. The runtime **does guarantee at-most-one execution attempt per recorded
   effect occurrence** within a run: resolution checks the journal first
   (recorded results are reused, per ADR-0004), and a requested effect is
   attempted once per run.
3. When an occurrence's outcome cannot be verified after a crash, its
   resolution is **`unknown`** — surfaced honestly, never fabricated.
4. **`idempotencyKey` is optional** on effects, for downstream systems that
   support deduplication; it is a cooperative mechanism, not a runtime
   guarantee.
5. **Durable execution is an integration**, not core: Temporal-style systems
   plug in as executors or persistence backends (§4).

## Options considered

- **Promise exactly-once.** Rejected: it is unimplementable for arbitrary
  external APIs, and one bank-transfer-style failure would destroy project
  credibility (Risk 6).
- **Promise at-least-once and retry aggressively.** Rejected: silently
  duplicating external side effects (double transfers, double emails) is
  worse than an honest `unknown`; retries exist, but only as explicit new
  effects (ADR-0005).
- **Declare delivery semantics out of scope entirely.** Rejected: users
  building on the boundary need documented, honest semantics to design
  their own recovery; silence would force every adopter to rediscover
  scenario B the hard way.

## Consequences

**Positive**

- The project's claims stay true under audit; `unknown` gives crash
  recovery a sound vocabulary.
- Integration with durable executors becomes a clean story rather than a
  contradiction of core promises.
- Replay remains trustworthy: resolution-from-journal never re-executes.

**Negative**

- Applications must handle `unknown` and, where it matters, supply
  idempotency keys or choose durable executors; some effects are simply
  unsuitable for unsafe retry.
- The guarantee set is subtler to communicate than "reliable execution".

**Neutral**

- Idempotency keys are inert metadata to the core; no dedup logic is
  centralized.

## References

- Roadmap §4 (Temporal/DBOS/Restate as executors), §15 (1.0 non-promises),
  §16 (persistence scope), §18 Risk 6, §19 (`unknown`), §0.14.0 (crash
  scenarios A/B; mandated disclosure; idempotencyKey), §0.3.0 (pending).
- Related: ADR-0003 (journal as truth), ADR-0004 (replay never re-executes),
  ADR-0005 (retries are new effects; `unknown` state).
