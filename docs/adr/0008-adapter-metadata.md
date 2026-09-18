# ADR 0008: Portable Contract versus Adapter Metadata

- **Status:** Accepted
- **Date:** 2026-09-17

## Context

Adapters translate framework-specific agent activity into effects. OpenAI
SDK call objects, LangGraph node internals, provider request IDs, rate-limit
headers, and token accounting all differ per framework — and §0.0.6 frames
the key rule after building the second adapter: if both frameworks need
private metadata, the answer is *portable fields + adapter metadata*, never
contaminating the core. §2.1 requires the core to know nothing about
LangGraph, OpenAI, Mastra, or any provider; §2.5 permits opaque metadata but
bans it from the portable contract. The conformance suite (§0.0.6) exists to
prove neutrality, and the roadmap's strongest success signal (§17) is a third
party implementing an adapter without touching core.

§24 asks whether `model.invoke` represents semantic inference or the exact
provider request, and recommends: semantic core + provider metadata.

## Decision

1. The **portable contract consists of typed core fields only**: `Effect`
   (id, type, input, runId, parentEffectId), `EffectResult` (status, output,
   error), journal entries, and their schemas.
2. **Adapter-specific data lives in namespaced `metadata`** (e.g.,
   `metadata["openai.requestId"]`), on effects and results. Core never
   interprets it; metadata is excluded from the portability promise.
3. **Conformance tests ignore metadata.** An adapter passes by producing
   correct core fields; no test may depend on adapter-private fields.
4. **`model.invoke` represents semantic inference intent** — provider,
   model, messages, tool definitions, sampling config — not a raw provider
   HTTP request. Provider-exact payloads, headers, and response envelopes
   belong in metadata.

## Options considered

- **Provider-shaped core** (carry OpenAI-style request/response objects as
  the canonical `model.invoke` contract). Rejected: the core becomes
  OpenAI-flavored, portability and cross-language fixtures (§0.11.0) die,
  and every other adapter must lie about its framework.
- **No metadata escape hatch.** Rejected: adapters would either lose
  information needed for real integrations (cost tracking, request IDs,
  provider errors) or smuggle it into core fields — the exact contamination
  §0.0.6 forbids.
- **Per-adapter journals or side-channel logs.** Rejected: fragments the
  single source of truth (ADR-0003) and makes replay, diff, and audit
  blind to adapter reality.

## Consequences

**Positive**

- Third parties can write adapters without touching core — the §17 success
  metric — and conformance results stay meaningful and comparable.
- The core schema remains small, stable, and implementable in any language.
- Upgrading an adapter's private metadata never breaks the portable format.

**Negative**

- Metadata is unvalidated by the core; abusers can stuff semantics into it,
  and documentation must set expectations that metadata is not portable.
- Some provider detail (exact prompts as sent, retries by the provider SDK)
  is not reconstructed from core fields alone.

**Neutral**

- Namespace naming is convention; formal registry only if collisions appear.
- Capability declarations (§11) remain separate from metadata.

## References

- Roadmap §2.1 (runtime-agnostic), §2.5 (metadata outside the portable
  contract), §6 (`model.invoke` semantic intent), §11 (capabilities),
  §17 (third-party adapter metric), §24 (model.invoke recommendation),
  §0.0.5 (first adapter), §0.0.6 (portable fields + adapter metadata;
  conformance), §0.10.0 (adapter spec), §0.11.0 (cross-language fixtures),
  §0.15.0 (stable adapter API candidate).
- Related: ADR-0001 (typed effects), ADR-0003 (single journal truth),
  ADR-0009 (schemas cover portable fields only).
