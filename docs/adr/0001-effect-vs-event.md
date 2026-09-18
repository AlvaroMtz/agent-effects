# ADR 0001: Effects versus Events

- **Status:** Accepted
- **Date:** 2026-09-17

## Context

Agent frameworks typically record what happened during a run as events:
`tool.executed`, `model.responded`, `run.finished`. An event is a fact about
the past. It can be logged and audited, but it arrives too late to influence
anything: the side effect already occurred before the record exists.

The roadmap (§2.2) identifies this as the foundational modeling choice.
The entire value proposition of the project (§1) — deterministic replay,
offline mocks, audit, policy enforcement, human approval, forks, run diffing,
snapshots, observability, and adapter portability — requires a representation
of what the agent **requests** to happen, captured at the boundary before the
outside world is touched. A runtime that only sees events cannot deny an
execution, ask for approval first, simulate a tool, or recover a previously
recorded result.

The roadmap also fixes the vocabulary: the journal is expressed as an
append-only sequence whose entries are facts (`effect.requested`,
`effect.resolved`), while the things flowing through the runtime are requests.

## Decision

1. **Effects are first-class, serializable, intentional requests.** An
   `Effect` records what the agent asks the runtime to make happen, before
   it happens. The core taxonomy starts small (roadmap §6, 1.0 candidate):
   `model.invoke`, `tool.invoke`, `human.request`, `agent.invoke`,
   `state.read`, `state.write`, `artifact.read`, `artifact.write`,
   `timer.wait` — not all of which exist in `0.0.1`.
2. **Events are journal facts only.** The journal stores lifecycle facts
   about effects — `run.started`, `effect.requested`, `effect.resolved`,
   `run.completed`, `run.failed` — in append-only order (§2.3, §0.0.2).
3. **Effects must be JSON-serializable** (§2.5). Functions, class instances,
   sockets, promises, closures, and database connections are never part of
   the portable representation.
4. **Runtime operations act on effects:** execute, reject, require approval,
   simulate, recover a prior result, or delegate (§2.2).

## Options considered

- **Events-only journal.** Rejected: an event stream cannot intercept
  execution before it happens, so policy, approval, simulation, and replay
  are all impossible or retrofitted after the fact.
- **Effects as opaque `{type, payload}` wrappers.** Rejected: this is
  exactly the failure mode of Risk 1 (§18) — an abstraction with no
  semantics, no concrete schemas, and no meaningful conformance tests.
- **Full event-sourcing framework with projections and sagas.** Rejected:
  it makes the core large and framework-shaped, violating §2.6 (core
  understandable in an afternoon) and the non-goals (§3).

## Consequences

**Positive**

- Replay, mocks, policy, approval, forks, diffing, and audit all derive
  naturally from one explicit representation (§1).
- The effects/events split gives a precise vocabulary: requests flow
  through the runtime; facts accumulate in the journal.
- A small typed taxonomy (Risk 1 mitigation) keeps conformance tests meaningful.

**Negative**

- Contributors must learn and keep distinct two vocabularies and their
  lifecycles.
- Every agent operation must cross the effect boundary to be visible,
  which is work adapters have to do honestly.

**Neutral**

- The taxonomy is expected to stay small and grow slowly, if at all.
- Journal entry kinds may gain fields or kinds additively under ADR-0009.

## References

- Roadmap §1 (vision and derived capabilities), §2.2 (effects, no events),
  §2.3 (append-only journal example), §2.5 (JSON-first), §2.6 (small core),
  §3 (non-goals), §6 (initial effect taxonomy), §18 Risk 1.
- Related: ADR-0002 (effect identity), ADR-0003 (journal), ADR-0008
  (portable contract).
