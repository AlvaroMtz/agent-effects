# ADR 0011: Executors Return an Execution Outcome; the Runtime Owns the Result

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

In `0.0.1` the executor seam is `execute(effect): Promise<EffectResult>`
(ADR-0005 defines `EffectResult`). Two problems surfaced once the runtime
was implemented and reviewed.

**The executor controls identity.** `EffectResult` carries `effectId`, so
the executor decides which effect a result belongs to. The `0.0.1` runtime
returns the executor's result verbatim: an executor dispatched `fx_1` can
report `effectId: "fx_999"` and the runtime records it. Identity is
producer-assigned and validated at the boundary (ADR-0002 §5), so handing
it back to the outermost, least trusted component contradicts the decision
that put it there.

**The executor can report states it cannot observe.** `EffectResult` has
six resolution states (ADR-0005 §3). `unknown` describes a persistence
outcome the runtime discovers, `denied` belongs to a policy engine that
does not exist yet, `cancelled` needs cancellation semantics, and
`pending` needs a suspend/resume lifecycle. An executor returning
`pending` in `0.0.1` produces an effect the runtime records as requested
and never resolves, and a later resolution of the same id is rejected as a
duplicate. The type permits a state the lifecycle cannot honor.

Both problems come from one cause: a single type spans what the outside
world reports and what the runtime concludes.

## Decision

1. Executors return an **`ExecutionOutcome`**: either
   `{ status: "ok", output: JsonValue }` or
   `{ status: "error", error: SerializableError, retryable?: boolean }`.
   The outcome carries **no effect id** and no resolution state beyond
   these two.
2. The **runtime converts an outcome into an `EffectResult`**, stamping
   `effectId` from the effect it dispatched. The executor cannot name a
   different effect, and the journal's resolved entry cannot disagree with
   its own `effectId`.
3. A **thrown executor** is converted by the runtime into an
   `ExecutionFailure` with the `execution-failed` code, because native
   exceptions do not cross the portable boundary (ADR-0005).
4. **`EffectResult` keeps all six states.** They remain representable and
   remain the runtime's vocabulary; ADR-0005 §3 shipped them whole
   precisely to avoid a later breaking change, and nothing here narrows the
   consumer-facing union. What changes is that `pending`, `cancelled` and
   `denied` are no longer reachable *from an executor*: they are produced
   by lifecycle, cancellation and policy machinery when those exist.
5. `unknown` stays the runtime's answer when the executor completed but the
   resolution could not be recorded (ADR-0007 §3).

## Options considered

- **Keep `EffectResult` on the executor and validate the id in the
  runtime.** Rejected: it detects the violation instead of making it
  unrepresentable, and leaves the executor able to return states no
  executor can observe. A contract that needs a guard is weaker than a
  contract that needs none.
- **Reduce `EffectResult` to `ok`/`error`/`unknown`.** Rejected: it is the
  breaking change ADR-0005 §3 was written to prevent, and it is redundant
  once an executor can only return two states.
- **Let the runtime overwrite `effectId` silently.** Rejected: it hides a
  contract violation rather than removing it, and a mismatch is a real
  defect in the executor that deserves to be uncompilable.

## Consequences

**Positive**

- Effect identity has exactly one owner: the producer assigns it, the
  runtime carries it, nothing else can restate it.
- `EffectResolvedEntry.result.effectId === entry.effectId` holds by
  construction rather than by assertion.
- Non-terminal executor results become unrepresentable, removing a branch
  the `0.0.1` runtime had to handle without any requirement describing it.

**Negative**

- Breaking change for every executor written against `0.0.1`: the returned
  object drops `effectId` and returns `{ status, output }`. The migration
  is mechanical and documented.

**Neutral**

- `ExecutionOutcome` is a new name in the public surface; it is the
  executor seam's input type, not a sixth abstraction.

## References

- Roadmap §5 (executor seam), §0.0.1 scope (five abstractions).
- Related: ADR-0002 (producer-assigned identity), ADR-0005 (serializable
  errors, six resolution states), ADR-0007 (`unknown` and at-most-one
  attempt), ADR-0012 (journal entries are self-contained).
