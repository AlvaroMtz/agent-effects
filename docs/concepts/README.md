# Concepts

The vocabulary of milestone **0.0.1**: what an effect is, how it resolves, and
what this project refuses to promise. Every answer below maps to a named
requirement in the effect-core or journal specification, so the documentation
and the specification cannot drift apart silently.

## What an effect is

An effect is a **serializable request**: a first-class record of what the agent
asks the runtime to make happen, written down *before* it happens. It carries a
producer-assigned id, a run id, a kind, and an input. The portable
representation is JSON — functions, promises, class instances, sockets and
connections never appear in it. Adapter-specific values live under namespaced
`metadata` keys that the core never reads or interprets.

Milestone 0.0.1 supports exactly two kinds: `tool.invoke`, which names a tool
and its arguments, and `model.invoke`, which represents semantic inference
intent — model, messages, tool definitions, sampling configuration — never a
provider-specific HTTP payload.

*Effect Core Specification → Requirement: Effect Is a Serializable Request;
Requirement: Effect Kinds in Scope.*

## What an effect is not

An effect is **not an event**. Facts about what already happened are journal
entries, not effects. The distinction is the whole point of the boundary: a
request is something the runtime may still decide to reuse, reject, or dispatch,
while a journal entry is a fact that has already been recorded and can never be
rewritten.

*Effect Core Specification → Requirement: Effect Is a Serializable Request;
Journal Specification → Requirement: Append-Only Source of Truth.*

## Who assigns the id

The **producer** — the agent code or adapter that submits the effect — assigns
the id before submission. It is an opaque string, required, and unique within a
run. The runtime validates its presence at the boundary: an absent or blank id
is rejected as an invalid request before anything is written to the journal and
before the executor is ever called. A duplicate id inside a run is rejected by
the journal writer and surfaced to the caller as an invalid request too.

*Effect Core Specification → Requirement: Identity Is Validated at the Boundary.*

## How resolution works

Resolution is **journal-first**. Earlier sketches of this project described a
`validate → policy → execute → journal → result` pipeline; that ordering is
superseded. The journal is consulted before any dispatch, so a recorded
occurrence is never executed a second time:

```
resolve(effect)
  ├─ 1. validate the producer-assigned id      → invalid-request, nothing written
  ├─ 2. journal.findResult(effect.id)          → recorded result returned unchanged
  ├─ 3. journal.append(effect.requested)       → the request fact, before dispatch
  ├─ 4. executor.execute(effect)               → exactly one attempt
  ├─ 5. journal.append(effect.resolved)        → the resolution fact
  └─ 6. return the result
```

Step 2 is what makes replay possible at all: replay is **resolution from the
journal**, never re-execution. This project says *effect-level deterministic
replay* and never claims perfect deterministic agent replay.

*Effect Core Specification → Requirement: Resolution Consults the Journal First;
Requirement: At Most One Execution Attempt per Recorded Occurrence.*

## When the journal is written

Twice per resolved occurrence, both times by the runtime: the request fact
before dispatch, and the resolution fact once execution completes. The journal
writer — not the caller — stamps each entry with a strictly monotonic per-run
`sequence`, a `schemaVersion` written at creation, and a timestamp. The sequence
records append order only; causality is expressed exclusively through explicit
links such as `parentEffectId`.

Milestone 0.0.1 defines four entry kinds — `run.started`, `effect.requested`,
`effect.resolved`, `run.completed` — and the runtime writes exactly two of them.
The run-lifecycle pair is defined but unwritten in this milestone, because a
synchronous factory that never receives a run id cannot honestly record a run.

*Journal Specification → Requirement: Entry Kinds in Scope; Requirement:
Strictly Monotonic Per-Run Sequence; Requirement: Every Entry Carries a Schema
Version.*

## How errors are represented

As data, never as exceptions. A failed resolution carries a serializable error —
a stable string code, a message, and optional details and an advisory
`retryable` flag. Native exceptions do not cross the boundary.

The result model exposes **six resolution states**, all representable from day
one so that consumers never face a breaking change when the later ones start
being produced:

| State | Produced in 0.0.1 | Meaning |
|-------|-------------------|---------|
| `ok` | yes | the executor resolved the effect and the output is recorded |
| `error` | yes | the effect failed; the serializable error explains how |
| `unknown` | yes | the executor completed but the outcome could not be recorded |
| `pending` | no | deferred to human-in-the-loop effects |
| `cancelled` | no | deferred to cancellation support |
| `denied` | no | deferred to the policy engine |

A retry is a **new effect with a fresh id**, linked to its predecessor through
metadata. There is no attempt counter on the model.

*Effect Core Specification → Requirement: Effect Results Have Six Resolution
States.*

## What happens if the journal fails

If the journal fails while recording the **request**, the caller receives an
error result with the `persistence-failed` code and the effect is never
dispatched. Nothing ran, so nothing is uncertain.

*Effect Core Specification → Requirement: Persistence and Execution Failures
Have Defined Outcomes.*

## What happens if the executor completes but the result cannot be persisted

The caller receives `unknown` — never a fabricated `ok` or `error`. The side
effect may or may not have happened, and no journal design can retroactively
make that outcome certain. This is exactly why `unknown` is a first-class state
rather than an error code.

*Effect Core Specification → Requirement: Persistence and Execution Failures
Have Defined Outcomes.*

## What this milestone does not promise

> Effect runtime cannot guarantee exactly-once for arbitrary external side
> effects.

What it does guarantee is narrower and honest: **at most one execution attempt
per recorded occurrence** within a run. Stronger delivery guarantees belong to
durable execution systems, which this project deliberately keeps at integration
distance.

*Effect Core Specification → Requirement: At Most One Execution Attempt per
Recorded Occurrence.*

## Journals are sensitive by default

Every journal is treated as material that requires access control; storing or
sharing one is the application's explicit decision. The core and the in-memory
backend never filter, redact, or mutate entries — there is no hidden scrubbing,
no heuristic scanning, and no post-hoc rewrite. A value that looks like a secret
is stored and returned verbatim, and a test asserts exactly that.

An explicit opt-in redaction hook at the journal-writer boundary is **deferred
beyond this milestone**: the seam is documented here, not implemented. No
`beforeAppend` transformer exists on `EffectJournal.append` or on the
`MemoryEffectJournal` constructor in 0.0.1; its interface arrives with the
threat model.

*Journal Specification → Requirement: Entries Are Sensitive by Default.*

## Conventions

- **One journal instance per run.** Entries are keyed by run id, so a shared
  instance keeps per-run sequences separate, but `findResult` takes an effect id
  alone. Keeping one journal per run removes the ambiguity at the source.
- **The in-memory backend is process-local.** It makes no durability claim
  beyond the life of the process and consults no external storage.

*Journal Specification → Requirement: The In-Memory Backend Is Process-Local.*
