import { describe, expect, test } from "vitest";
import { createActivityLog } from "../src/log/activityLog";
import type { ActivityInput, Clock } from "../src/types";

/**
 * REQ-007: a hand-cranked clock. The test decides what "now" is; nothing
 * anywhere reads Date.now(), and nothing sleeps.
 */
function manualClock(initial = 1_000) {
  let now = initial;
  const clock: Clock = () => now;
  return {
    clock,
    set(t: number) {
      now = t;
    },
    advance(by: number) {
      now += by;
      return now;
    },
    get now() {
      return now;
    },
  };
}

const WIDE = { start: 0, end: Number.MAX_SAFE_INTEGER };

describe("REQ-001 — record an entry", () => {
  test("test_REQ_001_records_an_entry_and_a_later_query_returns_it", () => {
    const t = manualClock(1_700);
    const log = createActivityLog({ clock: t.clock });

    log.record({
      actor: "alice",
      action: "vote.recorded",
      metadata: { ballotSize: 3 },
    });

    const result = log.queryByActor("alice");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      actor: "alice",
      action: "vote.recorded",
      timestamp: 1_700,
      metadata: { ballotSize: 3 },
    });
  });

  test("test_REQ_001_returns_the_stored_entry_from_record", () => {
    const t = manualClock(500);
    const log = createActivityLog({ clock: t.clock });

    const entry = log.record({ actor: "bob", action: "tally.completed" });

    expect(entry.actor).toBe("bob");
    expect(entry.action).toBe("tally.completed");
    expect(entry.timestamp).toBe(500);
    expect(typeof entry.seq).toBe("number");
  });
});

describe("REQ-002 — reject invalid entries and record nothing", () => {
  const invalid: Array<[string, ActivityInput]> = [
    ["empty actor", { actor: "", action: "login" }],
    ["whitespace-only actor", { actor: "   ", action: "login" }],
    ["missing actor", { action: "login" } as unknown as ActivityInput],
    ["empty action", { actor: "alice", action: "" }],
    ["whitespace-only action", { actor: "alice", action: "  \t " }],
    ["missing action", { actor: "alice" } as unknown as ActivityInput],
  ];

  for (const [label, input] of invalid) {
    test(`test_REQ_002_rejects_${label.replace(/[^a-z]+/gi, "_")}`, () => {
      const t = manualClock();
      const log = createActivityLog({ clock: t.clock });

      // Positive control: a well-formed entry on the same log is accepted.
      expect(() =>
        log.record({ actor: "alice", action: "login" }),
      ).not.toThrow();
      expect(() => log.record(input)).toThrow();
    });

    test(`test_REQ_002_stores_nothing_when_rejecting_${label.replace(
      /[^a-z]+/gi,
      "_",
    )}`, () => {
      const t = manualClock();
      const log = createActivityLog({ clock: t.clock });

      try {
        log.record(input);
      } catch {
        // rejection is asserted by the sibling test; here we only care that
        // the store is untouched.
      }

      expect(log.queryByTimeRange(WIDE.start, WIDE.end)).toEqual([]);
      expect(log.queryByActor("alice").entries).toEqual([]);
    });
  }
});

describe("REQ-003 — query by actor, most recent first, total and stable", () => {
  test("test_REQ_003_returns_entries_most_recent_first", () => {
    const t = manualClock(100);
    const log = createActivityLog({ clock: t.clock });

    log.record({ actor: "alice", action: "first" });
    t.set(200);
    log.record({ actor: "alice", action: "second" });
    t.set(300);
    log.record({ actor: "alice", action: "third" });

    const actions = log.queryByActor("alice").entries.map((e) => e.action);
    expect(actions).toEqual(["third", "second", "first"]);
  });

  test("test_REQ_003_identical_timestamps_are_returned_highest_seq_first", () => {
    const t = manualClock(42);
    const log = createActivityLog({ clock: t.clock });

    // Clock never advances: three entries share one timestamp.
    log.record({ actor: "alice", action: "a" });
    log.record({ actor: "alice", action: "b" });
    log.record({ actor: "alice", action: "c" });

    const entries = log.queryByActor("alice").entries;
    expect(entries.map((e) => e.action)).toEqual(["c", "b", "a"]);
    expect(entries.map((e) => e.timestamp)).toEqual([42, 42, 42]);
    expect(entries[0].seq).toBeGreaterThan(entries[1].seq);
    expect(entries[1].seq).toBeGreaterThan(entries[2].seq);
  });

  test("test_REQ_003_repeating_the_same_query_yields_an_identical_order", () => {
    const t = manualClock(10);
    const log = createActivityLog({ clock: t.clock });

    log.record({ actor: "alice", action: "a" });
    log.record({ actor: "alice", action: "b" });
    t.set(20);
    log.record({ actor: "alice", action: "c" });
    t.set(10); // a coarse clock can go backwards between reads
    log.record({ actor: "alice", action: "d" });

    const first = log.queryByActor("alice").entries.map((e) => e.seq);
    const second = log.queryByActor("alice").entries.map((e) => e.seq);
    const third = log.queryByActor("alice").entries.map((e) => e.seq);

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  test("test_REQ_003_only_returns_entries_for_the_requested_actor", () => {
    const t = manualClock(10);
    const log = createActivityLog({ clock: t.clock });

    log.record({ actor: "alice", action: "a" });
    log.record({ actor: "bob", action: "b" });

    expect(log.queryByActor("alice").entries.map((e) => e.actor)).toEqual([
      "alice",
    ]);
  });
});

describe("REQ-004 — redact sensitive metadata by key name, irreversibly", () => {
  test("test_REQ_004_default_deny_list_key_is_stored_as_the_literal_REDACTED", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    log.record({
      actor: "alice",
      action: "login",
      metadata: { password: "hunter2" },
    });

    const stored = log.queryByActor("alice").entries[0];
    expect(stored.metadata.password).toBe("[REDACTED]");
  });

  test("test_REQ_004_deny_list_matching_is_case_insensitive", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    log.record({
      actor: "alice",
      action: "login",
      metadata: { Password: "hunter2", TOKEN: "abc123" },
    });

    const stored = log.queryByActor("alice").entries[0];
    expect(stored.metadata.Password).toBe("[REDACTED]");
    expect(stored.metadata.TOKEN).toBe("[REDACTED]");
  });

  test("test_REQ_004_caller_supplied_sensitive_key_is_redacted_too", () => {
    const t = manualClock();
    const log = createActivityLog({
      clock: t.clock,
      sensitiveKeys: ["homeAddress"],
    });

    log.record({
      actor: "alice",
      action: "profile.updated",
      metadata: { homeAddress: "12 Hoa Lac Street" },
    });

    const stored = log.queryByActor("alice").entries[0];
    expect(stored.metadata.homeAddress).toBe("[REDACTED]");
  });

  test("test_REQ_004_a_non_sensitive_key_keeps_its_value", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    log.record({
      actor: "alice",
      action: "login",
      metadata: { password: "hunter2", restaurantId: "pho-24", attempts: 2 },
    });

    const stored = log.queryByActor("alice").entries[0];
    expect(stored.metadata.restaurantId).toBe("pho-24");
    expect(stored.metadata.attempts).toBe(2);
  });

  test("test_REQ_004_redaction_is_irreversible_the_original_value_is_nowhere_in_the_entry", () => {
    const t = manualClock();
    const log = createActivityLog({
      clock: t.clock,
      sensitiveKeys: ["homeAddress"],
    });

    log.record({
      actor: "alice",
      action: "login",
      metadata: { password: "hunter2", homeAddress: "12 Hoa Lac Street" },
    });

    const stored = log.queryByActor("alice").entries[0];
    const serialised = JSON.stringify(stored);
    expect(serialised).not.toContain("hunter2");
    expect(serialised).not.toContain("12 Hoa Lac Street");
  });

  test("test_REQ_004_the_returned_entry_is_not_a_live_reference_into_the_store", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    const returned = log.record({
      actor: "alice",
      action: "login",
      metadata: { password: "hunter2", ip: "10.0.0.1" },
    });

    returned.metadata.password = "hunter2";
    returned.metadata.ip = "MUTATED";
    returned.actor = "mallory";

    const stored = log.queryByActor("alice").entries[0];
    expect(stored.metadata.password).toBe("[REDACTED]");
    expect(stored.metadata.ip).toBe("10.0.0.1");
    expect(stored.actor).toBe("alice");
  });

  test("test_REQ_004_mutating_the_caller_metadata_after_record_does_not_change_the_store", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    const metadata: Record<string, unknown> = { ip: "10.0.0.1" };
    log.record({ actor: "alice", action: "login", metadata });
    metadata.ip = "MUTATED";

    expect(log.queryByActor("alice").entries[0].metadata.ip).toBe("10.0.0.1");
  });
});

describe("REQ-004 — redaction and copying apply at every depth", () => {
  test("test_REQ_004_a_sensitive_key_nested_one_level_down_is_redacted", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    // Positive control: the same key at the top level is already redacted.
    log.record({
      actor: "alice",
      action: "login",
      metadata: { password: "hunter2" },
    });
    expect(log.queryByActor("alice").entries[0].metadata.password).toBe(
      "[REDACTED]",
    );

    log.record({
      actor: "bob",
      action: "profile.updated",
      metadata: { profile: { password: "hunter2" } },
    });

    const stored = log.queryByActor("bob").entries[0];
    expect(stored.metadata.profile).toEqual({ password: "[REDACTED]" });
    expect(JSON.stringify(stored)).not.toContain("hunter2");
  });

  test("test_REQ_004_a_sensitive_key_nested_several_levels_down_is_redacted", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    log.record({
      actor: "alice",
      action: "profile.updated",
      metadata: { a: { b: { c: { token: "abc123" } } } },
    });

    const stored = log.queryByActor("alice").entries[0];
    expect(stored.metadata.a).toEqual({ b: { c: { token: "[REDACTED]" } } });
    expect(JSON.stringify(stored)).not.toContain("abc123");
  });

  test("test_REQ_004_a_sensitive_key_inside_an_array_of_objects_is_redacted", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    log.record({
      actor: "alice",
      action: "batch.imported",
      metadata: {
        users: [
          { name: "alice", password: "hunter2" },
          { name: "bob", secret: "swordfish" },
        ],
      },
    });

    const stored = log.queryByActor("alice").entries[0];
    expect(stored.metadata.users).toEqual([
      { name: "alice", password: "[REDACTED]" },
      { name: "bob", secret: "[REDACTED]" },
    ]);
    const serialised = JSON.stringify(stored);
    expect(serialised).not.toContain("hunter2");
    expect(serialised).not.toContain("swordfish");
  });

  test("test_REQ_004_a_caller_supplied_sensitive_key_nested_one_level_down_is_redacted", () => {
    const t = manualClock();
    const log = createActivityLog({
      clock: t.clock,
      sensitiveKeys: ["homeAddress"],
    });

    // Positive control: the caller's key is redacted at the top level.
    log.record({
      actor: "alice",
      action: "profile.updated",
      metadata: { homeAddress: "12 Hoa Lac Street" },
    });
    expect(log.queryByActor("alice").entries[0].metadata.homeAddress).toBe(
      "[REDACTED]",
    );

    log.record({
      actor: "bob",
      action: "profile.updated",
      metadata: { profile: { homeAddress: "12 Hoa Lac Street" } },
    });

    const stored = log.queryByActor("bob").entries[0];
    expect(stored.metadata.profile).toEqual({ homeAddress: "[REDACTED]" });
    expect(JSON.stringify(stored)).not.toContain("12 Hoa Lac Street");
  });

  test("test_REQ_004_a_nested_non_sensitive_value_survives_unchanged", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    log.record({
      actor: "alice",
      action: "vote.recorded",
      metadata: {
        ballot: { rankings: ["pho", "banh"], attempts: 2, note: "no beef" },
        password: "hunter2",
      },
    });

    const stored = log.queryByActor("alice").entries[0];
    expect(stored.metadata.ballot).toEqual({
      rankings: ["pho", "banh"],
      attempts: 2,
      note: "no beef",
    });
    expect(stored.metadata.password).toBe("[REDACTED]");
  });

  test("test_REQ_004_mutating_a_nested_object_in_the_caller_metadata_does_not_change_the_store", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    const nested = { ip: "10.0.0.1", tags: ["first"] };
    const metadata: Record<string, unknown> = { request: nested };
    log.record({ actor: "alice", action: "login", metadata });

    nested.ip = "MUTATED";
    nested.tags.push("second");

    expect(log.queryByActor("alice").entries[0].metadata.request).toEqual({
      ip: "10.0.0.1",
      tags: ["first"],
    });
  });

  test("test_REQ_004_mutating_a_nested_object_on_a_returned_entry_does_not_change_the_store", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    const returned = log.record({
      actor: "alice",
      action: "login",
      metadata: { request: { ip: "10.0.0.1" }, users: [{ name: "alice" }] },
    });

    (returned.metadata.request as Record<string, unknown>).ip = "MUTATED";
    (returned.metadata.users as Array<Record<string, unknown>>)[0].name =
      "mallory";

    const stored = log.queryByActor("alice").entries[0];
    expect(stored.metadata.request).toEqual({ ip: "10.0.0.1" });
    expect(stored.metadata.users).toEqual([{ name: "alice" }]);
  });

  test("test_REQ_004_mutating_a_nested_object_on_a_queried_entry_does_not_change_the_store", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    log.record({
      actor: "alice",
      action: "login",
      metadata: { request: { ip: "10.0.0.1" } },
    });

    const first = log.queryByActor("alice").entries[0];
    (first.metadata.request as Record<string, unknown>).ip = "MUTATED";

    expect(log.queryByActor("alice").entries[0].metadata.request).toEqual({
      ip: "10.0.0.1",
    });
  });
});

describe("REQ-005 — query by time range, inclusive at both bounds", () => {
  function seeded() {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });
    t.set(100);
    log.record({ actor: "alice", action: "at-start" });
    t.set(150);
    log.record({ actor: "alice", action: "inside" });
    t.set(200);
    log.record({ actor: "alice", action: "at-end" });
    t.set(500);
    log.record({ actor: "alice", action: "outside" });
    return log;
  }

  test("test_REQ_005_an_entry_at_exactly_the_start_bound_is_inside", () => {
    const actions = seeded()
      .queryByTimeRange(100, 200)
      .map((e) => e.action);
    expect(actions).toContain("at-start");
  });

  test("test_REQ_005_an_entry_at_exactly_the_end_bound_is_inside", () => {
    const actions = seeded()
      .queryByTimeRange(100, 200)
      .map((e) => e.action);
    expect(actions).toContain("at-end");
  });

  test("test_REQ_005_an_entry_outside_the_range_is_excluded", () => {
    const actions = seeded()
      .queryByTimeRange(100, 200)
      .map((e) => e.action);
    expect(actions).not.toContain("outside");
    expect(actions).toHaveLength(3);
  });

  test("test_REQ_005_a_single_instant_range_matches_that_instant", () => {
    const actions = seeded()
      .queryByTimeRange(150, 150)
      .map((e) => e.action);
    expect(actions).toEqual(["inside"]);
  });

  test("test_REQ_005_start_after_end_returns_empty_rather_than_throwing", () => {
    const log = seeded();
    expect(() => log.queryByTimeRange(200, 100)).not.toThrow();
    expect(log.queryByTimeRange(200, 100)).toEqual([]);
  });
});

describe("REQ-006 — a query with no matches", () => {
  test("test_REQ_006_unknown_actor_returns_no_entries_and_actorKnown_false", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });
    log.record({ actor: "alice", action: "login" });

    expect(log.queryByActor("mallory")).toEqual({
      entries: [],
      actorKnown: false,
    });
  });

  test("test_REQ_006_a_known_actor_is_distinguishable_from_an_unknown_one", () => {
    const t = manualClock(100);
    const log = createActivityLog({ clock: t.clock });
    log.record({ actor: "alice", action: "login" });

    // Same "no activity in this window" outcome, different actorKnown flag.
    expect(log.queryByTimeRange(900, 1_000)).toEqual([]);
    expect(log.queryByActor("alice").actorKnown).toBe(true);
    expect(log.queryByActor("mallory").actorKnown).toBe(false);
  });

  test("test_REQ_006_known_actor_with_nothing_in_range_returns_empty_entries_with_actorKnown_true", () => {
    const t = manualClock(100);
    const log = createActivityLog({ clock: t.clock });
    log.record({ actor: "alice", action: "login" });

    expect(log.queryByActor("alice", { start: 900, end: 1_000 })).toEqual({
      entries: [],
      actorKnown: true,
    });
  });

  test("test_REQ_006_a_rejected_entry_does_not_make_an_actor_known", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    // REQ-002 says a rejected entry records nothing — including the actor id.
    expect(() => log.record({ actor: "alice", action: "" })).toThrow();

    expect(log.queryByActor("alice")).toEqual({
      entries: [],
      actorKnown: false,
    });
  });

  test("test_REQ_006_a_query_with_no_matches_does_not_throw", () => {
    const t = manualClock();
    const log = createActivityLog({ clock: t.clock });

    expect(() => log.queryByActor("nobody")).not.toThrow();
    expect(() => log.queryByTimeRange(0, 1)).not.toThrow();
  });
});

describe("REQ-007 — time is supplied, never read", () => {
  test("test_REQ_007_the_entry_timestamp_is_exactly_what_the_injected_clock_returned", () => {
    const t = manualClock(1_234_567);
    const log = createActivityLog({ clock: t.clock });

    const first = log.record({ actor: "alice", action: "a" });
    t.set(7);
    const second = log.record({ actor: "alice", action: "b" });
    t.advance(3);
    const third = log.record({ actor: "alice", action: "c" });

    expect(first.timestamp).toBe(1_234_567);
    expect(second.timestamp).toBe(7);
    expect(third.timestamp).toBe(10);
  });

  test("test_REQ_007_the_clock_is_called_once_per_record_and_never_during_a_query", () => {
    let calls = 0;
    const clock: Clock = () => {
      calls += 1;
      return 999;
    };
    const log = createActivityLog({ clock });

    log.record({ actor: "alice", action: "a" });
    expect(calls).toBe(1);

    log.queryByActor("alice");
    log.queryByTimeRange(0, 10_000);
    expect(calls).toBe(1);
  });
});
