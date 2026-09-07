# Spec: Activity Log

**Every team builds this, whatever your app idea is.**

Your app is yours. This one component is not — it is the fixed point that lets
judges in Hoa Lac, Da Nang and Ho Chi Minh compare teams fairly.

Budget roughly **20–25 minutes**. It is deliberately small.

---

## ⚠️ Read this before you start

**This spec is incomplete on purpose.**

Four requirements below are marked `[NEEDS CLARIFICATION]`. They are not
mistakes and they are not trick questions — they are the decisions a real spec
author forgot to make, and they are exactly the kind of gap that turns into a
production bug three months later.

**Do not guess. Do not let Copilot guess for you.**

Open **Plan Mode**, point it at this file, and ask it to find the ambiguities
before you write a line of code. Then decide, as a team, what each one should
be. Write your four decisions at the bottom of this file under *Decisions*.

You are scored on the quality of those decisions and your reasoning — **not on
matching a hidden answer.** There is more than one defensible answer to each.
A judge will ask you to justify one of them.

---

## Purpose

Record what happened in the system, so it can be queried later.

Every application has *actions* — a user logged in, an order shipped, a file
uploaded, a game started. This component records them and answers questions
about them.

## Scope

**In scope**

- An in-memory store of activity entries
- Recording an entry
- Querying entries by actor and by time range
- Redacting sensitive values before storage

**Out of scope** — do not build these, you do not have time

- Any database, file, or network persistence
- Any user interface
- Authentication or authorisation
- Log rotation, retention, or archival

## Data

An **entry** has:

| Field | Type | Notes |
| --- | --- | --- |
| `actor` | string | Who did it. Non-empty. |
| `action` | string | What they did. Non-empty. |
| `timestamp` | instant | When it happened. |
| `metadata` | key/value map | Optional. May contain sensitive values. |

---

## Requirements

### REQ-001 — Record an entry

WHEN a caller records an activity with an actor, an action and metadata,
THE SYSTEM SHALL store an entry and make it available to subsequent queries.

### REQ-002 — Reject invalid entries

IF the actor or the action is empty or absent,
THEN THE SYSTEM SHALL reject the entry and record nothing.

### REQ-003 — Query by actor

WHEN a caller queries by actor,
THE SYSTEM SHALL return all entries for that actor, most recent first.

> `[NEEDS CLARIFICATION]` Two entries can carry the same timestamp — clocks are
> coarse and systems are fast. What order are they returned in, and is that
> order guaranteed to be stable across repeated queries?

### REQ-004 — Redact sensitive metadata

WHEN an entry is recorded with sensitive values in its metadata,
THE SYSTEM SHALL store a redacted placeholder instead of the value.

> `[NEEDS CLARIFICATION]` What makes a value sensitive — the key name, the shape
> of the value, or a list the caller supplies? And is redaction reversible?

### REQ-005 — Query by time range

WHEN a caller queries with a start and an end time,
THE SYSTEM SHALL return every entry that falls within that range.

> `[NEEDS CLARIFICATION]` Is an entry whose timestamp is exactly the start or
> exactly the end inside the range or outside it?

### REQ-006 — Query with no matches

WHEN a query matches no entries,
THE SYSTEM SHALL return a result indicating no activity.

> `[NEEDS CLARIFICATION]` Is "this actor has done nothing" the same outcome as
> "this actor does not exist"? Should a caller be able to tell them apart?

### REQ-007 — Time is supplied, never read

THE SYSTEM SHALL obtain the current time from a source provided by the caller,
and SHALL NOT read the system clock directly.

> Not ambiguous — this one is a requirement. A component that reads the clock
> itself cannot be tested without waiting. Inject it.

---

## Acceptance

You are done when:

- [ ] All four `[NEEDS CLARIFICATION]` items are resolved and written down below
- [ ] Every requirement above has at least one test that references its `REQ-###`
- [ ] Tests were seen failing before the code existed
- [ ] Tests pass
- [ ] No database, file, network call, or UI
- [ ] Time is injected — no test sleeps or waits

---

## Decisions

*Fill this in. One or two sentences each. This is what a judge will ask about.*

| ID | Decision | Why |
| --- | --- | --- |
| REQ-003 | Entries with the same timestamp are ordered by insertion order, newest first: the most recently recorded entry appears before older entries with the same timestamp, and the ordering is deterministic across repeated queries. | This makes the ordering explicit, stable, and easy to test without inventing a second clock source. It preserves "most recent first" while resolving the tie without depending on system clock precision. |
| REQ-004 | A value is sensitive when its metadata key name is in a fixed denylist such as `password`, `token`, `secret`, `api_key`, `authorization`, or `session`. The stored replacement is a fixed placeholder `[REDACTED]`; redaction is not reversible. | This keeps the rule objective, predictable, and safe for an in-memory challenge. It avoids needing to inspect arbitrary value shapes or storing a reversible secret vault. |
| REQ-005 | The time-range is inclusive: an entry is inside the range when its timestamp is greater than or equal to the start and less than or equal to the end. | This aligns with the intuitive meaning of a range query and removes ambiguity at both boundary values. |
| REQ-006 | "No activity" and "unknown actor" are treated as the same external result: the query returns an empty list. The system does not distinguish between a non-existent actor and a valid actor with zero entries. | This keeps the API simple and consistent with the requirement "return a result indicating no activity" while avoiding a hidden state model or separate error cases. |
