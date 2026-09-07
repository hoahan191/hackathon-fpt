# Where are we eating?

Five people, five opinions, twenty minutes of "I don't mind, you pick". Everyone
ranks the lunch options once, a Borda count picks a single winner, and the app
says in one plain sentence how that winner got there — unanimous, a clear win, a
narrow edge, or a tie-break. Every ballot and every tally is written to an
activity log you can read on screen.

## Running it

Requires Node 22 (developed on v22.23.1) and npm.

```
npm install
npm run dev
```

Vite prints the local URL (default `http://localhost:5173`). Rank options by
clicking them, enter a name, submit a ballot, repeat for each voter, then press
**Decide**.

A production build:

```
npm run build
```

State lives in memory only — a page refresh discards every ballot and the whole
activity log.

## Running the tests

```
npm test
```

Healthy result: `Test Files 4 passed (4)`, `Tests 102 passed (102)`. The suite
runs with no network access and no API key, and no test sleeps or waits — time
is injected everywhere.

## How it's built

- `src/engine/tally.ts` — the Borda count. A pure function of candidates and
  ballots: no clock, no randomness, no I/O. It scores, breaks ties, computes the
  consensus margin, and throws on an empty election or a bad ballot.
- `src/log/activityLog.ts` — the activity log specified in
  [spec/activity-log.md](spec/activity-log.md). In-memory store, insertion
  sequence numbers, key-name redaction, queries by actor and by time range, and
  an injected clock.
- `src/explain/` — `explain.ts` builds the explanation from the tally alone.
  An `LlmClient` may be injected; if it is absent, unreachable, or returns text
  that fails to name the winner or names a rival, the deterministic sentence
  stands. `prompt.ts` sanitises candidate names and marks them as untrusted data
  before they enter a prompt.
- `src/app/election.ts` — the wiring. Validates a ballot, records
  `vote.recorded` to the log _before_ retaining it, runs the tally, records
  `tally.completed`.
- `src/ui/` and `src/App.tsx` — the React UI. `App.tsx` is the only place that
  reads the system clock, injecting it into the log.
- `test/` — four files, one per unit, each `describe` block named for the
  requirement it covers.

No LLM provider is wired up — only the `LlmClient` interface and the checks
around it; the tests supply stub clients in memory.

There are no UI tests. Everything under `src/ui/` and `src/App.tsx` is unverified
by the suite.

## Decisions

The activity-log spec left four points open. Full reasoning is in the Decisions
table of [spec/activity-log.md](spec/activity-log.md); in short:

- **Ordering under equal timestamps (REQ-003).** Every entry gets a
  store-assigned monotonic `seq`. Results are newest timestamp first, then
  higher `seq` first. Timestamps alone give a partial order, so any query could
  reshuffle the moment two entries share one; `seq` is the only value that
  actually knows insertion order, and callers cannot spoof it.
- **What counts as sensitive (REQ-004).** The key name, never the shape of the
  value, against a default deny-list plus any keys the caller adds — applied at
  every depth. Redaction is irreversible: `[REDACTED]` is stored and the
  original never enters the store, so leaking the log does not leak the secret.
- **Time-range boundaries (REQ-005).** Inclusive at both ends, `start <= t <=
end`. Coarse clocks put entries exactly on a boundary often, and inclusive is
  how a human reads "between 09:00 and 10:00". `start > end` returns nothing
  rather than throwing.
- **Nothing found vs. nobody there (REQ-006).** Same outcome, distinguishable:
  an actor query returns `entries: []` with an `actorKnown` flag. "You typed the
  id wrong" and "this person did nothing" lead to different actions, so the
  caller gets the answer without a second query. A rejected write never makes an
  actor known.

Two more decisions shaped the app itself:

- **Borda, not plurality.** Plurality asks only "what is your favourite?" and
  discards the rest of the ballot, so three people who love sushi beat four who
  put it last. Borda reads the whole ballot, so the place nobody loves but
  everybody accepts can win — usually the right answer for lunch.
- **The tie-break.** Highest score wins; if that is level, the most first-choice
  votes; if still level, the lowest `id` alphabetically. The rule is a total
  order, so the winner never depends on the order ballots arrived in. When the
  margin is 0 the explanation says the tie-break decided it, rather than
  dressing it up as a win.
