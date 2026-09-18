# @agent-effects/replay

Effect-level deterministic replay: resolves effects from a journal and never
re-executes them.

```ts
import { createReplayRuntime } from "@agent-effects/replay";
import { JsonlEffectJournal } from "@agent-effects/journal-jsonl";

const journal = await JsonlEffectJournal.open("run.jsonl");
const replay = createReplayRuntime({ journal });

// Same call as the live runtime, no provider reached.
const result = await replay.resolve(effect);
```

It implements the same `EffectRuntime` interface as the live runtime, so it is
a drop-in replacement, and it takes **a journal and nothing else**. There is no
executor seam: an external call during replay is not forbidden by policy, it is
unrepresentable.

## strict is the only mode

`strict` is the first and default mode (ADR-0004). A replay that cannot answer
from the journal fails loudly rather than quietly filling the gap:

| Situation | Outcome |
|-----------|---------|
| The occurrence was never requested | `ReplayMissError`, reason `no-recorded-request` |
| It was requested but never resolved | `ReplayMissError`, reason `no-recorded-resolution` |
| The effect differs from the one recorded | `ReplayMismatchError`, naming the field and both values |

These are thrown, not returned as error results. A miss is a failure of the
replay harness, not an outcome the agent produced; returning a result would let
a run continue on a fiction.

`passthrough` and `mock` modes are deferred past 0.1.0: both blend recorded and
fresh results, which makes "zero external calls" unverifiable.

## How an effect is matched

By its producer-assigned id, then verified on `type` and `input` through a
canonical comparison that ignores key order. `metadata` is excluded: adapter
data lives outside the portable contract, so a different provider request id is
not a divergence in the run.

The fingerprint is diagnostic only. Identity is the id, never the content —
two identical calls to the same tool are two decisions the agent made, and
collapsing them would destroy exactly the audit value this package exists for.
