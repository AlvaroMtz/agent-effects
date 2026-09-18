# Effect Core Specification

## Purpose

The effect core is the portable boundary between agentic computation and the outside world: an `Effect` is a serializable request, resolution yields an `EffectResult`, and the runtime coordinates journal-first resolution so that a recorded occurrence is never executed twice. Milestone 0.0.1 covers exactly the five in-scope abstractions — `Effect`, `EffectResult`, `EffectExecutor`, `EffectJournal`, `EffectRuntime` — and the effect kinds `tool.invoke` and `model.invoke`.

## Requirements

### Requirement: Effect Is a Serializable Request

An effect SHALL be a first-class, serializable, intentional request recording what the agent asks the runtime to make happen, before it happens. An effect SHALL NOT be an event: facts about what already happened are journal entries only. The id SHALL be a producer-assigned, opaque string, assigned by the producer (agent code or adapter) before submission, and each effect SHALL carry a run id and typed core fields (kind and input). The portable representation SHALL be JSON-serializable; functions, promises, class instances, sockets, and connections SHALL NOT appear in it. Adapter-specific data SHALL be confined to namespaced metadata that the core never interprets, and optional causality links (`parentEffectId` to the causing effect, `retryOf` to a retried predecessor) MAY be present.

#### Scenario: producer-assigned id on a serializable request
- GIVEN agent code submits an effect whose id, run id, kind, and input are JSON-serializable values
- WHEN the effect crosses the runtime boundary
- THEN the effect round-trips through JSON without losing core fields and keeps the producer-assigned id unchanged

#### Scenario: adapter data stays out of the portable contract
- GIVEN an adapter must carry a provider-specific value such as a provider request id
- WHEN it attaches that value to an effect
- THEN the value lives under a namespaced metadata key, the typed core fields are unchanged, and the core never reads or interprets that key
(Origin: docs/adr/0001-effect-vs-event.md:28,34,37; docs/adr/0002-effect-identity.md:25,33; docs/adr/0008-adapter-metadata.md:24,27; docs/adr/0006-concurrency.md:27)

### Requirement: Effect Results Have Six Resolution States

The result type model SHALL expose exactly six resolution states: `ok`, `error`, `pending`, `cancelled`, `denied`, `unknown`. All six SHALL be representable in this milestone even though the 0.0.1 runtime produces only `ok`, `error`, and `unknown`. A successful resolution SHALL carry its output. An errored resolution SHALL carry the portable serializable error — a stable string code, a message, and optional details and advisory retryable flag; native exceptions SHALL NOT cross the boundary.

#### Scenario: successful resolution carries its output
- GIVEN an executor resolves an effect successfully with a value
- WHEN the runtime returns the result
- THEN the resolution state is `ok` and the output equals the value the executor produced

#### Scenario: errored resolution carries the serializable error
- GIVEN an effect fails during execution
- WHEN the runtime returns the result
- THEN the resolution state is `error` and the error is a serializable value with a stable code and message, never a native exception
(Origin: docs/adr/0005-errors-and-retries.md:27,32-33)

### Requirement: Identity Is Validated at the Boundary

The presence of the effect id SHALL be validated when an effect is submitted. An effect without an id SHALL be rejected as an invalid request before any journal write and before any dispatch. Effect ids SHALL be unique within a run; when the journal rejects a duplicate id, the runtime SHALL surface that rejection to the caller as an invalid request.

#### Scenario: missing id is rejected before dispatch
- GIVEN an effect with an absent or empty id is submitted for resolution
- WHEN the runtime validates it at the boundary
- THEN the caller receives an error result with the invalid-request code, nothing is appended to the journal, and the executor is never invoked

#### Scenario: duplicate id within a run is surfaced as invalid
- GIVEN an effect id already recorded as requested in a run but carrying no recorded resolution
- WHEN a second effect reusing that id is resolved in the same run
- THEN the duplicate is rejected instead of recorded and the caller receives the invalid-request code
(Origin: docs/adr/0002-effect-identity.md:25,33-35; docs/adr/0003-journal-append-only.md:32-34)

### Requirement: Resolution Consults the Journal First

Resolution SHALL consult the journal for a recorded result of the effect occurrence before any dispatch. A recorded result SHALL be returned unchanged, and the executor SHALL NOT be invoked again for that recorded occurrence. When no recorded result exists, the request fact SHALL be recorded before dispatch and the resolution fact SHALL be recorded when execution completes.

#### Scenario: recorded result is reused without re-execution
- GIVEN an effect occurrence already has a recorded resolution in the run's journal
- WHEN the same occurrence is resolved again
- THEN the recorded result is returned unchanged and the executor is never invoked for it
(Origin: docs/adr/0007-exactly-once.md:28-30; docs/adr/0004-replay-semantics.md:25-27)

### Requirement: At Most One Execution Attempt per Recorded Occurrence

Within a run, the runtime SHALL attempt execution of a recorded effect occurrence at most once. The runtime SHALL NOT promise exactly-once execution of arbitrary external side effects, and the project documentation SHALL carry the mandated disclosure that "Effect runtime cannot guarantee exactly-once for arbitrary external side effects."

#### Scenario: one attempt per occurrence
- GIVEN a run in which an effect occurrence is requested and executed
- WHEN its resolution is recorded and any later resolution of the same occurrence happens
- THEN the executor has been invoked at most once for that occurrence and later resolutions reuse the recorded result

#### Scenario: disclosure wording is present
- GIVEN the milestone's conceptual documentation
- WHEN it is reviewed for delivery claims
- THEN it contains the sentence that the effect runtime cannot guarantee exactly-once for arbitrary external side effects
(Origin: docs/adr/0007-exactly-once.md:14,25-30)

### Requirement: Persistence and Execution Failures Have Defined Outcomes

If the journal fails while recording the request, the runtime SHALL report an error result with the persistence-failure code and SHALL NOT dispatch the effect. If the executor completed but the result cannot be persisted, the runtime SHALL report the `unknown` state, because the side effect may or may not have occurred. An executor that fails SHALL map to the execution-failure code, and a run-level failure SHALL map to the run-failure code.

#### Scenario: request cannot be recorded
- GIVEN a journal that fails when the request is appended
- WHEN an effect is resolved
- THEN the caller receives an error result with the persistence-failed code and the executor is never invoked

#### Scenario: completed but unpersistable result
- GIVEN an executor that completes and a journal that fails when the resolution is appended
- WHEN resolution finishes
- THEN the caller receives the `unknown` state and never a fabricated `ok` or `error`

#### Scenario: executor and run-level failures map to their codes
- GIVEN an executor that fails for an effect, and separately a run-level failure surfacing during resolution
- WHEN the runtime reports each outcome
- THEN the executor failure carries the execution-failed code and the run-level failure carries the run-failed code
(Origin: docs/adr/0007-exactly-once.md:25-31; docs/adr/0005-errors-and-retries.md:29-31)

### Requirement: Effect Kinds in Scope

This milestone SHALL support exactly two effect kinds: `tool.invoke` and `model.invoke`. A `tool.invoke` request SHALL name the tool to run and carry its arguments. A `model.invoke` request SHALL represent semantic inference intent — model, messages, tool definitions, sampling configuration — not a provider-specific request; provider-exact payloads SHALL live in namespaced metadata. No other kind SHALL be dispatchable in this milestone.

#### Scenario: model invocation stays semantic
- GIVEN a model invocation request carrying model, messages, and tool definitions
- WHEN it is represented or dispatched
- THEN the core fields stay provider-agnostic and any provider-exact payload lives in namespaced metadata
(Origin: docs/ROADMAP.md:861-865; docs/adr/0008-adapter-metadata.md:24,32)

### Requirement: The Documented Weather Example Resolves Successfully

A runtime created with an executor and a journal SHALL resolve the documented example — effect `fx_1` in run `run_1`, kind `tool.invoke`, invoking the weather tool for Madrid — to a successful result, and the run's journal SHALL record both the request fact and the resolution fact for that effect.

#### Scenario: mandatory example end to end
- GIVEN a runtime created with a working executor and an empty journal
- WHEN the documented weather tool invocation for effect `fx_1` in run `run_1` is resolved
- THEN the executor receives the named weather tool and its arguments, the result is successful, and the journal contains a request fact and a resolution fact for `fx_1`
(Origin: docs/ROADMAP.md:874-893)

### Requirement: Exit-Criteria Answers Are Traceable to This Specification

This specification SHALL answer the milestone's seven exit-criteria questions normatively: what an effect is and is not (serializable-request requirement), who assigns the id (the producer, validated at the boundary), when facts reach the journal (journal-first resolution), how errors are represented (serializable error and six states), and the two persistence-failure outcomes (journal fails on request; executor completes but the result cannot be persisted). Each answer SHALL map to a requirement in this specification with assertable scenarios.

#### Scenario: every exit-criteria question maps to a requirement
- GIVEN the seven exit-criteria questions of this milestone
- WHEN each question is traced through this specification
- THEN each question maps to at least one requirement that states the answer normatively
(Origin: docs/ROADMAP.md:919-929)
