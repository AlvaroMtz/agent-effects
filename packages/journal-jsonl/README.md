# @agent-effects/journal-jsonl

Append-only JSONL journal: one JSON object per line, so `cat run.jsonl` is
useful to a human.

```ts
import { JsonlEffectJournal } from "@agent-effects/journal-jsonl";
import { createRuntime } from "@agent-effects/core";

const journal = await JsonlEffectJournal.open("run.jsonl");
const runtime = createRuntime({ executor, journal });
```

One file holds any number of runs: sequences are per run and lookups are
addressed by `(runId, effectId)` (ADR-0012). `open()` reads the file once to
rebuild the per-run counters and the resolution index, so appends are `O(1)`
and lookups never re-read. A journal that cannot be read back refuses to open,
naming the offending line, rather than appending onto something it does not
understand.

## Reading a journal yourself

```ts
import { parseJournal, validateEntry, serializeEntry } from "@agent-effects/journal-jsonl";
```

- `parseJournal(text)` returns the entries, skipping blank lines, and throws a
  `JournalFormatError` carrying the 1-based `line` of the first unreadable one.
- `validateEntry(value)` checks a single value and returns it typed.
- `serializeEntry(entry)` produces one newline-terminated line.

Unknown fields inside the same major schema version are accepted and preserved;
a different major is refused with both versions named (ADR-0009 §3). The
normative format is `schemas/journal-entry.schema.json`, and `fixtures/journal/`
pins it for implementations in any language.

A journal is sensitive by default (ADR-0010). This backend writes the file
wherever it is told to and filters nothing.
