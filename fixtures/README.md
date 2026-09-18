# Fixtures

Recorded journals that pin the on-disk format, so any implementation can check
itself against the same bytes.

| Fixture | Since | What it pins |
|---------|-------|--------------|
| [`journal/basic-run.jsonl`](journal/basic-run.jsonl) | 0.0.2 | A complete run: start, a tool call, a model call, completion |
| [`journal/failed-run.jsonl`](journal/failed-run.jsonl) | 0.0.2 | An errored resolution and a `run.failed` entry |
| [`journal/forward-compatible.jsonl`](journal/forward-compatible.jsonl) | 0.0.2 | A newer minor version whose unknown fields must survive a round trip |
| [`journal/future-major.jsonl`](journal/future-major.jsonl) | 0.0.2 | A newer major version, which a reader must refuse |

Every entry in these files validates against
`schemas/journal-entry.schema.json`, and each journal round-trips byte for byte
through parse and serialize. Adding a fixture means adding a shape the format
promises to keep.

These are **format** fixtures. The behavioural conformance suite — the scenario
folders `basic-tool-call/`, `model-tool-model/`, `parallel-tools/`,
`failed-tool/`, `retry/`, `human-approval/` and `fork/`, which an
implementation runs to declare itself compatible — starts at 0.0.6 and becomes
cross-language at 0.11.0. See `docs/ROADMAP.md` §0.11.0.
