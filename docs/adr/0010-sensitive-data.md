# ADR 0010: Journals Are Sensitive by Default; Redaction Is Explicit

- **Status:** Accepted
- **Date:** 2026-09-17

## Context

A faithful journal records prompts, model outputs, tool arguments, and
artifact references — precisely the material that contains secrets, personal
data, and proprietary context. The roadmap's security milestone (§0.12.0)
enumerates the audit surface: secrets leakage, journal PII, prompt content,
tool arguments, artifact references, malicious journal inputs, replay of
destructive effects, untrusted serialized errors, and resource exhaustion.
It concludes with a design constraint: **never assume a journal can be
stored in plaintext without consequences**, and requires *redaction hooks*
and *sensitive fields* as first-class concepts. §16 makes "threat model and
redaction defined" part of the 1.0 Definition of Done, and §24 lists
"which fields are redacted before persistence" among the open questions.

Tension: ADR-0003 makes the journal the append-only source of truth, and
ADR-0004 makes replay faithful to what the journal contains. Any mechanism
that silently rewrites entries would corrupt both. The security lever must
therefore live at the write boundary, under the application's control.

## Decision

1. **Journals are sensitive by default.** Documentation and tooling treat
   every journal as containing material that requires access control;
   storing or sharing one is the application's explicit decision.
2. **Redaction is an explicit, opt-in hook at the journal-writer boundary.**
   Applications configure which fields and values are transformed before
   persistence; the hook applies to `effect.requested` and
   `effect.resolved` payloads alike.
3. **The core never mutates, filters, or redacts implicitly.** There is no
   hidden scrubbing, no heuristic scanning, and no post-hoc rewrite of
   persisted entries.
4. **Replay and policy operate on what the journal actually contains.**
   Redacted entries replay with redacted values; fidelity to the stored
   record is preserved by design.
5. The **threat model and the sensitive-field guidance** are defined at
   `0.12.0` (§0.12.0, §16); until then this ADR sets the default posture.

## Options considered

- **Implicit core redaction** (core detects and masks secrets automatically).
  Rejected: silent mutation of the source of truth breaks the append-only
  contract (ADR-0003), produces journals whose replay results differ from
  reality (ADR-0004), and creates false confidence — heuristics miss
  novel secret formats.
- **No redaction support at all.** Rejected: users would fork the writer or
  pre-sanitize inputs, fragmenting the ecosystem and pushing PII mistakes
  into every application.
- **Read-time redaction only.** Rejected: sensitive data would already be
  persisted, so every storage location, backup, and export leaks first and
  filters later — the opposite of the §0.12.0 constraint.

## Consequences

**Positive**

- Applications keep control and accountability: what is redacted is a
  configured, reviewable decision, not magic.
- The journal's integrity guarantees survive: redaction happens before
  persistence, never after.
- The 0.12.0 threat model lands on a stable posture instead of redesigning
  the journal.

**Negative**

- Default configurations persist sensitive data; documentation must say so
  loudly and early.
- Redacted entries cannot replay to their original outputs — an accepted
  cost of not persisting secrets.

**Neutral**

- The hook interface is expected to stay small; formalizing sensitive
  fields in schemas can proceed additively under ADR-0009.

## References

- Roadmap §16 (threat model and redaction in Definition of Done), §18 Risk
  5 (honesty in claims), §24 (secrets open question; ArtifactRef instead of
  blobs), §0.0.2 (journal format), §0.12.0 (security review scope;
  redaction hooks; sensitive fields; plaintext warning).
- Related: ADR-0003 (append-only truth), ADR-0004 (replay fidelity),
  ADR-0005 (untrusted serialized errors), ADR-0009 (additive schema
  evolution), ADR-0008 (artifact data stays out of core fields).
