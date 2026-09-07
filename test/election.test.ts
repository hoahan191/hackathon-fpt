import { describe, expect, test, vi } from "vitest";
import { createElection, SYSTEM_ACTOR } from "../src/app/election";
import { createActivityLog } from "../src/log/activityLog";
import type { ActivityLog } from "../src/log/activityLog";
import type {
  ActivityEntry,
  ActivityInput,
  Ballot,
  Clock,
  Restaurant,
} from "../src/types";

/**
 * REQ-007: the test owns "now". Nothing here reads Date.now(), sleeps, or
 * installs fake timers.
 */
function manualClock(initial = 1_000) {
  let now = initial;
  const clock: Clock = () => now;
  return {
    clock,
    set(t: number) {
      now = t;
    },
    get now() {
      return now;
    },
  };
}

const CANDIDATES: Restaurant[] = [
  { id: "pho", name: "Pho 24" },
  { id: "banh", name: "Banh Mi Huynh Hoa" },
  { id: "sushi", name: "Sushi Bar" },
];

/**
 * A hand-written ActivityLog so the unit tests isolate the election: it does
 * exactly what the real log's contract promises and nothing more, and it takes
 * its timestamps from the injected clock (REQ-007).
 */
function stubLog(clock: Clock) {
  let seq = 0;
  const stored: ActivityEntry[] = [];
  const record = vi.fn((input: ActivityInput): ActivityEntry => {
    const entry: ActivityEntry = {
      actor: input.actor,
      action: input.action,
      timestamp: clock(),
      metadata: input.metadata ?? {},
      seq: seq++,
    };
    stored.push(entry);
    return entry;
  });
  const queryByActor = vi.fn(() => ({ entries: [], actorKnown: false }));
  const queryByTimeRange = vi.fn(() => [] as ActivityEntry[]);
  const log: ActivityLog = { record, queryByActor, queryByTimeRange };
  return { log, record, queryByActor, queryByTimeRange, stored };
}

function inputsFor(record: ReturnType<typeof stubLog>["record"]) {
  return record.mock.calls.map(([input]) => input);
}

describe("REQ-111 — record the election to the activity log", () => {
  test("test_REQ_111_casting_a_ballot_records_one_vote_recorded_entry_for_the_voter", () => {
    const t = manualClock(1_000);
    const { log, record } = stubLog(t.clock);
    const election = createElection({ candidates: CANDIDATES, log });

    election.castBallot({ voterId: "alice", rankings: ["pho", "banh"] });

    const votes = inputsFor(record).filter((i) => i.action === "vote.recorded");
    expect(votes).toHaveLength(1);
    expect(votes[0].actor).toBe("alice");
  });

  test("test_REQ_111_each_accepted_ballot_records_under_its_own_voter_id", () => {
    const t = manualClock(1_000);
    const { log, record } = stubLog(t.clock);
    const election = createElection({ candidates: CANDIDATES, log });

    election.castBallot({ voterId: "alice", rankings: ["pho"] });
    election.castBallot({ voterId: "bao", rankings: ["banh"] });

    const actors = inputsFor(record)
      .filter((i) => i.action === "vote.recorded")
      .map((i) => i.actor);
    expect(actors).toEqual(["alice", "bao"]);
  });

  test("test_REQ_111_completing_a_tally_records_one_tally_completed_entry_carrying_winner_and_margin", () => {
    const t = manualClock(1_000);
    const { log, record } = stubLog(t.clock);
    const election = createElection({ candidates: CANDIDATES, log });

    election.castBallot({
      voterId: "alice",
      rankings: ["pho", "banh", "sushi"],
    });
    election.castBallot({ voterId: "bao", rankings: ["pho", "sushi", "banh"] });
    const result = election.tally();

    const tallies = inputsFor(record).filter(
      (i) => i.action === "tally.completed",
    );
    expect(tallies).toHaveLength(1);
    expect(tallies[0].metadata).toMatchObject({
      winnerId: result.winner.id,
      consensusMargin: result.consensusMargin,
    });
  });

  test("test_REQ_111_the_tally_entry_actor_is_the_exported_system_actor", () => {
    const t = manualClock(1_000);
    const { log, record } = stubLog(t.clock);
    const election = createElection({ candidates: CANDIDATES, log });

    election.castBallot({
      voterId: "alice",
      rankings: ["pho", "banh", "sushi"],
    });
    election.tally();

    const tallies = inputsFor(record).filter(
      (i) => i.action === "tally.completed",
    );
    expect(tallies).toHaveLength(1);
    expect(tallies[0].actor).toBe(SYSTEM_ACTOR);
    expect(SYSTEM_ACTOR.trim()).not.toBe("");
  });

  test("test_REQ_111_a_ballot_ranking_an_unknown_id_records_nothing", () => {
    const t = manualClock(1_000);
    const { log, record } = stubLog(t.clock);
    const election = createElection({ candidates: CANDIDATES, log });

    // Positive control: a well-formed ballot on this same election is accepted.
    expect(() =>
      election.castBallot({ voterId: "alice", rankings: ["pho"] }),
    ).not.toThrow();
    const before = record.mock.calls.length;

    expect(() =>
      election.castBallot({ voterId: "bao", rankings: ["taco-truck"] }),
    ).toThrow();
    expect(record.mock.calls.length).toBe(before);
  });

  test("test_REQ_111_a_ballot_ranking_the_same_id_twice_records_nothing", () => {
    const t = manualClock(1_000);
    const { log, record } = stubLog(t.clock);
    const election = createElection({ candidates: CANDIDATES, log });

    // Positive control: a well-formed ballot on this same election is accepted.
    expect(() =>
      election.castBallot({ voterId: "alice", rankings: ["pho", "banh"] }),
    ).not.toThrow();
    const before = record.mock.calls.length;

    expect(() =>
      election.castBallot({ voterId: "bao", rankings: ["pho", "pho"] }),
    ).toThrow();
    expect(record.mock.calls.length).toBe(before);
  });

  test("test_REQ_111_a_rejected_ballot_is_not_kept_in_the_election", () => {
    const t = manualClock(1_000);
    const { log } = stubLog(t.clock);
    const election = createElection({ candidates: CANDIDATES, log });

    // Positive control: a well-formed ballot on this same election is accepted.
    expect(() =>
      election.castBallot({ voterId: "alice", rankings: ["pho"] }),
    ).not.toThrow();

    expect(() =>
      election.castBallot({ voterId: "bao", rankings: ["taco-truck"] }),
    ).toThrow();
    expect(election.ballots().map((b) => b.voterId)).toEqual(["alice"]);
  });

  test("test_REQ_111_entry_timestamps_come_from_the_logs_injected_clock", () => {
    const t = manualClock(1_000);
    const { log, stored } = stubLog(t.clock);
    const election = createElection({ candidates: CANDIDATES, log });

    election.castBallot({
      voterId: "alice",
      rankings: ["pho", "banh", "sushi"],
    });
    t.set(4_242);
    election.tally();

    expect(stored.map((e) => [e.action, e.timestamp])).toEqual([
      ["vote.recorded", 1_000],
      ["tally.completed", 4_242],
    ]);
  });

  test("test_REQ_111_the_election_never_supplies_a_time_of_its_own", () => {
    const t = manualClock(1_000);
    const { log, record } = stubLog(t.clock);
    const election = createElection({ candidates: CANDIDATES, log });

    election.castBallot({
      voterId: "alice",
      rankings: ["pho", "banh", "sushi"],
    });
    election.tally();

    for (const input of inputsFor(record)) {
      expect(input).not.toHaveProperty("timestamp");
      expect(Object.keys(input.metadata ?? {})).not.toContain("timestamp");
    }
  });

  test("test_REQ_111_end_to_end_votes_and_tally_are_queryable_from_the_real_log", () => {
    const t = manualClock(1_000);
    const log = createActivityLog({ clock: t.clock });
    const election = createElection({ candidates: CANDIDATES, log });

    const first: Ballot = {
      voterId: "alice",
      rankings: ["pho", "banh", "sushi"],
    };
    const second: Ballot = {
      voterId: "bao",
      rankings: ["pho", "sushi", "banh"],
    };

    election.castBallot(first);
    t.set(2_000);
    election.castBallot(second);
    t.set(3_000);
    const result = election.tally();

    // REQ-003: newest first, per actor.
    const alice = log.queryByActor("alice");
    expect(alice.actorKnown).toBe(true);
    expect(alice.entries.map((e) => [e.action, e.timestamp])).toEqual([
      ["vote.recorded", 1_000],
    ]);

    const system = log.queryByActor(SYSTEM_ACTOR);
    expect(system.actorKnown).toBe(true);
    expect(system.entries).toHaveLength(1);
    expect(system.entries[0]).toMatchObject({
      action: "tally.completed",
      timestamp: 3_000,
      metadata: {
        winnerId: result.winner.id,
        consensusMargin: result.consensusMargin,
      },
    });

    // REQ-005: inclusive at both bounds; chronological by the injected clock.
    const inRange = log.queryByTimeRange(1_000, 3_000);
    expect(
      [...inRange]
        .sort((a, b) => a.seq - b.seq)
        .map((e) => [e.actor, e.action, e.timestamp]),
    ).toEqual([
      ["alice", "vote.recorded", 1_000],
      ["bao", "vote.recorded", 2_000],
      [SYSTEM_ACTOR, "tally.completed", 3_000],
    ]);
  });
});

describe("REQ-111 — a ballot the log refuses is not retained", () => {
  test("test_REQ_111_an_empty_voter_id_throws_and_leaves_the_ballots_unchanged", () => {
    const t = manualClock(1_000);
    const log = createActivityLog({ clock: t.clock });
    const election = createElection({ candidates: CANDIDATES, log });

    // Positive control: a valid ballot IS retained on this same election.
    election.castBallot({ voterId: "alice", rankings: ["pho", "banh"] });
    expect(election.ballots().map((b) => b.voterId)).toEqual(["alice"]);
    const before = election.ballots();

    // REQ-002: an empty actor is refused by the log.
    expect(() =>
      election.castBallot({ voterId: "", rankings: ["pho"] }),
    ).toThrow();
    expect(election.ballots()).toEqual(before);
    expect(log.queryByTimeRange(0, Number.MAX_SAFE_INTEGER)).toHaveLength(1);
  });

  test("test_REQ_111_a_whitespace_only_voter_id_throws_and_leaves_the_ballots_unchanged", () => {
    const t = manualClock(1_000);
    const log = createActivityLog({ clock: t.clock });
    const election = createElection({ candidates: CANDIDATES, log });

    // Positive control: a valid ballot IS retained on this same election.
    election.castBallot({ voterId: "alice", rankings: ["pho", "banh"] });
    expect(election.ballots().map((b) => b.voterId)).toEqual(["alice"]);
    const before = election.ballots();

    expect(() =>
      election.castBallot({ voterId: "  \t ", rankings: ["pho"] }),
    ).toThrow();
    expect(election.ballots()).toEqual(before);
  });

  test("test_REQ_111_a_ballot_rejected_by_the_log_does_not_count_in_a_later_tally", () => {
    const t = manualClock(1_000);
    const log = createActivityLog({ clock: t.clock });
    const election = createElection({ candidates: CANDIDATES, log });

    // Positive control: two honest ballots put 'banh' ahead of 'pho'.
    election.castBallot({
      voterId: "alice",
      rankings: ["banh", "pho", "sushi"],
    });
    election.castBallot({ voterId: "bao", rankings: ["banh", "pho", "sushi"] });
    expect(election.tally().winner.id).toBe("banh");

    // Three unlogged ballots for 'pho' must not be able to overturn that.
    for (const rankings of [
      ["pho", "sushi", "banh"],
      ["pho", "sushi", "banh"],
      ["pho", "sushi", "banh"],
    ]) {
      expect(() => election.castBallot({ voterId: "", rankings })).toThrow();
    }

    expect(election.ballots()).toHaveLength(2);
    expect(election.tally().winner.id).toBe("banh");
  });

  test("test_REQ_111_a_ballot_is_not_retained_when_the_log_throws_for_any_reason", () => {
    const t = manualClock(1_000);
    const { log, record } = stubLog(t.clock);
    const election = createElection({ candidates: CANDIDATES, log });

    // Positive control: while the log is healthy, the ballot IS retained.
    election.castBallot({ voterId: "alice", rankings: ["pho", "banh"] });
    expect(election.ballots().map((b) => b.voterId)).toEqual(["alice"]);
    const before = election.ballots();

    record.mockImplementationOnce(() => {
      throw new Error("log: store unavailable");
    });

    expect(() =>
      election.castBallot({ voterId: "bao", rankings: ["banh", "pho"] }),
    ).toThrow();
    expect(election.ballots()).toEqual(before);
  });

  test("test_REQ_111_a_ballot_refused_by_the_log_leaves_no_trace_in_the_real_log_either", () => {
    const t = manualClock(1_000);
    const log = createActivityLog({ clock: t.clock });
    const election = createElection({ candidates: CANDIDATES, log });

    // Positive control: a valid ballot is both retained and logged.
    election.castBallot({ voterId: "alice", rankings: ["pho"] });
    expect(log.queryByActor("alice").entries).toHaveLength(1);

    expect(() =>
      election.castBallot({ voterId: "   ", rankings: ["banh"] }),
    ).toThrow();

    expect(election.ballots().map((b) => b.voterId)).toEqual(["alice"]);
    expect(log.queryByActor("   ").actorKnown).toBe(false);
    expect(log.queryByTimeRange(0, Number.MAX_SAFE_INTEGER)).toHaveLength(1);
  });
});
