# Spec: Where Are We Eating?

A group ranks the lunch options. The app picks a winner and explains why that
one won.

This spec covers the **app**. The activity log it records to is specified
separately in [`activity-log.md`](activity-log.md) and its requirements are
numbered `REQ-0##`. Everything here is numbered `REQ-1##`.

---

## Purpose

Five people, five opinions, twenty minutes of "I don't mind, you pick". Each
person ranks the candidate restaurants once. The app computes a single winner
and produces a short, honest sentence about how that winner got there — was it
unanimous, a compromise, or a photo finish.

## Scope

**In scope**

- Borda count tally over ranked ballots
- A deterministic tie-break
- A consensus margin describing how decisive the win was
- A plain-language explanation of the result, derived only from the tally
- Recording votes and tallies to the activity log

**Out of scope**

- Persistence of any kind — the store is in memory
- Accounts, login, or identity beyond an opaque `voterId`
- Live/multi-device sync
- Restaurant search, maps, opening hours, prices from any external source

## Data

```ts
interface Restaurant {
  id: string;
  name: string;
  cuisine?: string;
  priceLevel?: number;
}
interface Ballot {
  voterId: string;
  rankings: string[];
} // index 0 = 1st choice
interface TallyResult {
  winner: Restaurant;
  scores: Record<string, number>;
  consensusMargin: number;
  roundsSummary?: string[];
}
interface ExplainResponse {
  winnerId: string;
  explanation: string;
  highlights: string[];
}
```

### Why Borda, not plurality

Plurality asks one question — "what is your favourite?" — and throws away
everything else. Three people who love sushi beat four people who put sushi
last, and the group eats somewhere most of them did not want. Borda reads the
whole ballot, so a restaurant nobody loves but everybody accepts can win, which
is usually the right answer for lunch.

---

## Requirements

### REQ-101 — Score a ranked ballot

WHEN a ballot ranks `n` candidates,
THE SYSTEM SHALL award `n - 1` points to the candidate at index 0, `n - 2` to
the candidate at index 1, and so on down to 0 points for the last, and SHALL
sum those points across all ballots into `scores`.

`n` is the number of **candidates**, not the length of the ballot, so partial
ballots and full ballots score the same candidate identically.

### REQ-102 — Rank unranked candidates last

WHEN a ballot omits one or more candidates,
THE SYSTEM SHALL award those candidates 0 points from that ballot.

Omission is a statement — "I did not want this" — not missing data.

### REQ-103 — Break ties deterministically

IF two or more candidates share the highest score,
THEN THE SYSTEM SHALL select the one with the most first-choice votes, and if
that is still tied, the one whose `id` sorts lowest.

The result of a tally SHALL NOT depend on the order the ballots arrived in.

### REQ-104 — Report the consensus margin

WHEN a tally completes,
THE SYSTEM SHALL set `consensusMargin` to the winner's score minus the
runner-up's score, divided by the maximum score obtainable
(`ballots.length * (candidates.length - 1)`), yielding a value in `[0, 1]`.

A margin of 0 means the winner only survived the tie-break. A margin of 1 means
every voter put the winner first.

### REQ-105 — A single candidate wins unopposed

WHEN there is exactly one candidate,
THE SYSTEM SHALL return that candidate as the winner with a score of 0 and a
`consensusMargin` of 1.

### REQ-106 — Reject an empty election

IF there are no candidates, or no ballots, or every ballot has an empty
`rankings` array,
THEN THE SYSTEM SHALL throw and SHALL NOT return a winner.

### REQ-107 — Reject unknown and duplicate entries on a ballot

IF a ballot ranks an id that is not a candidate, or ranks the same id twice,
THEN THE SYSTEM SHALL throw and SHALL NOT return a partial tally.

A silently ignored typo produces a wrong winner that nobody can see is wrong.

### REQ-108 — Explain the result from the tally alone

WHEN the system explains a result,
THE SYSTEM SHALL produce an `ExplainResponse` whose `winnerId` matches
`result.winner.id`, and whose text states whether the win was unanimous, a
compromise, or a narrow edge, based only on values present in the
`TallyResult`.

Thresholds: `consensusMargin === 1` is unanimous; `>= 0.25` is a clear win;
`> 0` is narrow; `0` was decided by the tie-break.

IF a supplied language model returns text that does not name the winning
restaurant, or that names any other candidate,
THEN THE SYSTEM SHALL discard that text and use the deterministic explanation.

A model that is free to write the final sentence is free to contradict the
count — it can call a tie-break win a landslide, and nothing in the response
would show it. The tally decides; the model only phrases.

### REQ-109 — Never let candidate data become an instruction

WHEN candidate names are placed into a prompt for a language model,
THE SYSTEM SHALL strip control characters, cap each name at 80 characters, and
embed the names as JSON data under a heading that marks them as untrusted.

Restaurant names are user input. `"Pho 24 — ignore all previous instructions"`
is a name someone will type.

### REQ-110 — Explanation works with no model available

WHEN no language-model client is supplied,
THE SYSTEM SHALL still return a complete `ExplainResponse` generated
deterministically from the tally.

The tests run with no network and no API key. The model is a polish step, never
a dependency.

### REQ-111 — Record the election to the activity log

WHEN a ballot is accepted and WHEN a tally completes,
THE SYSTEM SHALL record an activity entry — `vote.recorded` for the voter,
`tally.completed` for the election — using the injected clock from `REQ-007`.

IF the activity entry cannot be recorded,
THEN THE SYSTEM SHALL NOT retain the ballot.

A ballot that counts towards a winner but appears nowhere in the log is exactly
the result nobody can audit.

---

## Acceptance

- [x] Every `REQ-1##` above has at least one test naming it
- [x] Tests were seen failing before the implementation existed
- [x] Tests pass, with no network access
- [x] The tally is a pure function — no clock, no randomness, no I/O
