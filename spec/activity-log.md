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
be. Write your four decisions at the bottom of this file under _Decisions_.

You are scored on the quality of those decisions and your reasoning — **not on
matching a hidden answer.** There is more than one defensible answer to each.
A judge will ask you to justify one of them.

---

## Purpose

Record what happened in the system, so it can be queried later.

Every application has _actions_ — a user logged in, an order shipped, a file
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

| Field       | Type          | Notes                                   |
| ----------- | ------------- | --------------------------------------- |
| `actor`     | string        | Who did it. Non-empty.                  |
| `action`    | string        | What they did. Non-empty.               |
| `timestamp` | instant       | When it happened.                       |
| `metadata`  | key/value map | Optional. May contain sensitive values. |

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

- [x] All four `[NEEDS CLARIFICATION]` items are resolved and written down below
- [x] Every requirement above has at least one test that references its `REQ-###`
- [x] Tests were seen failing before the code existed
- [x] Tests pass
- [x] No database, file, network call, or UI — the component is in-memory only; the
      app's React UI reads it through `queryByActor` / `queryByTimeRange`
- [x] Time is injected — no test sleeps or waits

---

## Decisions

| ID      | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| REQ-003 | Every entry gets a monotonic insertion sequence number `seq`. Entries are returned newest first by `timestamp`, and where timestamps are equal, by higher `seq` first (last recorded, first returned). The order is total and identical on every repeated query.                                                                                                                                                                                                                                            | Timestamps alone give a partial order, so a sort on timestamp alone is unstable the moment two entries share one. `seq` is assigned by the store, never by the caller, so it cannot be spoofed and it is the only thing that genuinely knows insertion order.                                                                                                                                                                                                                        |
| REQ-004 | Sensitivity is decided by the **key name**, never by inspecting the value. A default case-insensitive deny-list (`password`, `passwd`, `secret`, `token`, `apiKey`, `otp`, `pin`, `cvv`, `cardNumber`, `ssn`) is applied, plus any extra keys the caller supplies at construction. Redaction is **irreversible**: the store holds the literal string `[REDACTED]` and the original value never enters the store. Key matching and copying apply at **every depth** of the metadata, not just the top level. | Shape-sniffing values produces false negatives on anything that does not look like a secret, and false positives on ordinary text. Key names are what the caller controls and can reason about. Irreversible means a leak of the log is not a leak of the secret — reversible redaction is encryption with extra steps, and we have no key management.                                                                                                                               |
| REQ-005 | The range is **inclusive at both ends**: an entry with `timestamp === start` or `timestamp === end` is inside. Formally `start <= t <= end`. `start > end` returns no entries rather than throwing.                                                                                                                                                                                                                                                                                                         | Half-open ranges silently drop the entry that lands exactly on a boundary, and coarse clocks make that a common case, not a rare one. Inclusive matches how a human reads "between 09:00 and 10:00". Both boundaries have their own test.                                                                                                                                                                                                                                            |
| REQ-006 | They are the **same outcome but distinguishable**. An actor query returns `{ entries: [], actorKnown: false }` for an actor the store has never seen, and `{ entries: [], actorKnown: true }` for a known actor with nothing to show — reachable because `queryByActor` takes an optional time range. A rejected entry (REQ-002) does **not** make an actor known. No error is thrown either way.                                                                                                           | "No results" is not an error — a caller asking a legitimate question got a legitimate answer. But "you typed the actor id wrong" and "this person did nothing" lead to different actions, so the caller gets one flag to tell them apart without a second query. The flag is driven only by entries that were actually stored: if a rejected write made an actor known, REQ-002's "record nothing" would not be true, and anyone could grow the known-actor set with invalid writes. |
