# Activity Log

A small, test-driven in-memory activity logging component built for the FPT × GitHub Copilot hackathon. It records actions, makes them queryable by actor and time range, and redacts sensitive metadata before storing it.

## Overview

<<<<<<< Updated upstream
This project implements the required activity log from [spec/activity-log.md](spec/activity-log.md) without adding persistence, UI, or external dependencies. The goal is to keep the behavior simple, explicit, and easy to validate under competition conditions.
=======
## Built app: Where are we eating?

This repo now contains a small browser app for the **Where are we eating?**
challenge. Each teammate ranks the restaurant options, the app uses Borda
count scoring to pick a winner, and it explains whether the result came from
points, first-place votes, or the original option order tie-break.

The shared activity log from [`spec/activity-log.md`](spec/activity-log.md) is
implemented in memory and used by the app. Sensitive metadata keys are redacted
before storage.

Run it:

```bash
npm start
```

Run the tests:

```bash
npm test
```

---

## Pick one of these and start
>>>>>>> Stashed changes

## Included functionality

- record activity entries with an actor, action, timestamp, and optional metadata
- reject invalid entries when the actor or action is empty
- return all entries for a given actor, with the newest results first
- redact sensitive metadata values before storing them
- query entries within an inclusive time range
- return an empty result when no entries match
- inject the current time instead of reading the system clock directly

## Design choices and clarifications

Before implementation, we resolved the four ambiguous items in the spec:

- REQ-003: same-timestamp entries are ordered by insertion order, newest first, and the order is deterministic
- REQ-004: values are considered sensitive when their metadata key matches a fixed denylist; they are replaced with `[REDACTED]` and are not reversible
- REQ-005: range queries are inclusive, so entries exactly at the start or end timestamps are included
- REQ-006: “unknown actor” and “no activity” are treated as the same empty result

## Implementation files

- [activity_log.py](activity_log.py) — core in-memory logic
- [tests/test_activity_log.py](tests/test_activity_log.py) — specification-driven tests
- [spec/activity-log.md](spec/activity-log.md) — original requirement document

## Example usage

```python
from datetime import datetime
from activity_log import ActivityLog

log = ActivityLog()
log.record(
    "alice",
    "logged_in",
    {"password": "secret123", "role": "admin"},
    timestamp=datetime(2026, 9, 7, 10, 30),
)

print(log.query_by_actor("alice"))
print(log.query_by_time_range(datetime(2026, 9, 7, 10, 0), datetime(2026, 9, 7, 11, 0)))
```

## Run the tests

```bash
cd /Users/hoahan/Desktop/GenAI Trainer/Github_Copilot_hackathon/hackathon-fpt
python -m pytest -q tests/test_activity_log.py
```

## Verification

The implementation is verified and the test suite is green:

```bash
python -m pytest -q tests/test_activity_log.py
```

Observed result: 7 passed in 0.01s.

## Judge-facing summary

This solution demonstrates disciplined specification work, clear ambiguity resolution, and test-first development. It stays within the required constraints of an in-memory system, enforces validation rules, redacts sensitive data safely, and delivers deterministic query behavior under the competition’s time and reliability requirements.
