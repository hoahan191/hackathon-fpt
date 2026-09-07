import { describe, expect, test } from "vitest";
import { bordaTally } from "../src/engine/tally";
import type { Ballot, Restaurant } from "../src/types";

const A: Restaurant = { id: "a", name: "Pho 24" };
const B: Restaurant = { id: "b", name: "Banh Mi Huynh Hoa" };
const C: Restaurant = { id: "c", name: "Sushi Hokkaido" };
const THREE = [A, B, C];

function ballot(voterId: string, ...rankings: string[]): Ballot {
  return { voterId, rankings };
}

/**
 * A valid election used as a positive control alongside every rejection test,
 * so "it threw" can never be mistaken for "everything throws".
 */
const VALID_BALLOTS = [
  ballot("v1", "a", "b", "c"),
  ballot("v2", "b", "a", "c"),
];

describe("REQ-101 — score a ranked ballot", () => {
  test("test_REQ_101_awards_n_minus_1_down_to_0_and_sums_across_ballots", () => {
    // 3 candidates => 1st = 2 points, 2nd = 1 point, 3rd = 0 points.
    //   v1 [a,b,c] -> a+2 b+1 c+0
    //   v2 [a,c,b] -> a+2 c+1 b+0
    //   v3 [b,a,c] -> b+2 a+1 c+0
    const result = bordaTally(THREE, [
      ballot("v1", "a", "b", "c"),
      ballot("v2", "a", "c", "b"),
      ballot("v3", "b", "a", "c"),
    ]);

    expect(result.scores).toEqual({ a: 5, b: 3, c: 1 });
    expect(result.winner).toEqual(A);
  });

  test("test_REQ_101_points_are_based_on_the_candidate_count_not_the_ballot_length", () => {
    // Both ballots put "a" first, so "a" scores 2 from each even though one
    // ballot is partial.
    const result = bordaTally(THREE, [
      ballot("v1", "a"),
      ballot("v2", "a", "b", "c"),
    ]);

    expect(result.scores.a).toBe(4);
  });
});

describe("REQ-102 — rank unranked candidates last", () => {
  test("test_REQ_102_a_candidate_omitted_from_a_ballot_scores_0_from_that_ballot", () => {
    //   v1 [a]     -> a+2, b+0, c+0
    //   v2 [a,b]   -> a+2, b+1, c+0
    const result = bordaTally(THREE, [
      ballot("v1", "a"),
      ballot("v2", "a", "b"),
    ]);

    expect(result.scores).toEqual({ a: 4, b: 1, c: 0 });
  });

  test("test_REQ_102_a_candidate_on_no_ballot_still_appears_in_scores_with_0", () => {
    const result = bordaTally(THREE, [ballot("v1", "a", "b")]);

    expect(result.scores).toHaveProperty("c", 0);
  });
});

describe("REQ-103 — break ties deterministically", () => {
  test("test_REQ_103_a_score_tie_is_broken_by_most_first_choice_votes", () => {
    //   v1 [a,b,c] -> a2 b1 c0
    //   v2 [a,c,b] -> a2 c1 b0
    //   v3 [b,c,a] -> b2 c1 a0
    //   v4 [c,b,a] -> c2 b1 a0
    // scores: a=4 b=4 c=4 ; first choices: a=2 b=1 c=1
    const result = bordaTally(THREE, [
      ballot("v1", "a", "b", "c"),
      ballot("v2", "a", "c", "b"),
      ballot("v3", "b", "c", "a"),
      ballot("v4", "c", "b", "a"),
    ]);

    expect(result.scores).toEqual({ a: 4, b: 4, c: 4 });
    expect(result.winner.id).toBe("a");
  });

  test("test_REQ_103_a_tie_on_score_and_first_choices_is_broken_by_lowest_id", () => {
    // "zebra" is first in the candidate array, "apple" sorts lowest.
    const zebra: Restaurant = { id: "zebra", name: "Zebra Grill" };
    const apple: Restaurant = { id: "apple", name: "Apple Cafe" };

    const result = bordaTally(
      [zebra, apple],
      [ballot("v1", "zebra", "apple"), ballot("v2", "apple", "zebra")],
    );

    expect(result.scores).toEqual({ zebra: 1, apple: 1 });
    expect(result.winner.id).toBe("apple");
  });

  test("test_REQ_103_shuffling_ballot_order_does_not_change_the_result", () => {
    const ballots = [
      ballot("v1", "a", "b", "c"),
      ballot("v2", "a", "c", "b"),
      ballot("v3", "b", "a", "c"),
    ];
    const reversed = [...ballots].reverse();
    const rotated = [ballots[1], ballots[2], ballots[0]];

    const base = bordaTally(THREE, ballots);
    const fromReversed = bordaTally(THREE, reversed);
    const fromRotated = bordaTally(THREE, rotated);

    expect(fromReversed.winner).toEqual(base.winner);
    expect(fromReversed.scores).toEqual(base.scores);
    expect(fromReversed.consensusMargin).toBe(base.consensusMargin);
    expect(fromRotated.winner).toEqual(base.winner);
    expect(fromRotated.scores).toEqual(base.scores);
  });

  test("test_REQ_103_shuffling_ballot_order_does_not_change_a_tie_break", () => {
    const ballots = [
      ballot("v1", "a", "b", "c"),
      ballot("v2", "a", "c", "b"),
      ballot("v3", "b", "c", "a"),
      ballot("v4", "c", "b", "a"),
    ];

    const base = bordaTally(THREE, ballots);
    const shuffled = bordaTally(THREE, [...ballots].reverse());

    expect(shuffled.winner.id).toBe(base.winner.id);
  });
});

describe("REQ-104 — report the consensus margin", () => {
  test("test_REQ_104_margin_is_winner_minus_runner_up_over_the_maximum_obtainable", () => {
    // scores a=5 b=3 c=1 ; max = ballots(3) * (candidates(3) - 1) = 6
    // margin = (5 - 3) / 6 = 0.333...
    const result = bordaTally(THREE, [
      ballot("v1", "a", "b", "c"),
      ballot("v2", "a", "c", "b"),
      ballot("v3", "b", "a", "c"),
    ]);

    expect(result.consensusMargin).toBeCloseTo(2 / 6, 10);
  });

  test("test_REQ_104_a_unanimous_election_gives_a_margin_of_exactly_1", () => {
    // 2 candidates, 3 ballots, everyone puts "a" first:
    // a = 3, b = 0, max = 3 * 1 = 3, margin = 3 / 3 = 1
    const result = bordaTally(
      [A, B],
      [ballot("v1", "a", "b"), ballot("v2", "a", "b"), ballot("v3", "a", "b")],
    );

    expect(result.scores).toEqual({ a: 3, b: 0 });
    expect(result.consensusMargin).toBe(1);
  });

  test("test_REQ_104_a_win_decided_only_by_the_tie_break_gives_a_margin_of_0", () => {
    const result = bordaTally(THREE, [
      ballot("v1", "a", "b", "c"),
      ballot("v2", "a", "c", "b"),
      ballot("v3", "b", "c", "a"),
      ballot("v4", "c", "b", "a"),
    ]);

    expect(result.consensusMargin).toBe(0);
  });

  test("test_REQ_104_margin_is_within_the_closed_unit_interval", () => {
    const result = bordaTally(THREE, [
      ballot("v1", "a", "b", "c"),
      ballot("v2", "b", "a", "c"),
    ]);

    expect(result.consensusMargin).toBeGreaterThanOrEqual(0);
    expect(result.consensusMargin).toBeLessThanOrEqual(1);
  });
});

describe("REQ-105 — a single candidate wins unopposed", () => {
  test("test_REQ_105_single_candidate_wins_with_score_0_and_margin_1", () => {
    const result = bordaTally([A], [ballot("v1", "a"), ballot("v2", "a")]);

    expect(result.winner).toEqual(A);
    expect(result.scores).toEqual({ a: 0 });
    expect(result.consensusMargin).toBe(1);
  });
});

describe("REQ-106 — reject an empty election", () => {
  test("test_REQ_106_throws_when_there_are_no_candidates", () => {
    expect(() => bordaTally(THREE, VALID_BALLOTS)).not.toThrow();
    expect(() => bordaTally([], [ballot("v1", "a")])).toThrow();
  });

  test("test_REQ_106_throws_when_there_are_no_ballots", () => {
    expect(() => bordaTally(THREE, VALID_BALLOTS)).not.toThrow();
    expect(() => bordaTally(THREE, [])).toThrow();
  });

  test("test_REQ_106_throws_when_every_ballot_has_empty_rankings", () => {
    expect(() => bordaTally(THREE, VALID_BALLOTS)).not.toThrow();
    expect(() => bordaTally(THREE, [ballot("v1"), ballot("v2")])).toThrow();
  });
});

describe("REQ-107 — reject unknown and duplicate entries on a ballot", () => {
  test("test_REQ_107_throws_for_an_id_that_is_not_a_candidate", () => {
    expect(() => bordaTally(THREE, VALID_BALLOTS)).not.toThrow();
    expect(() =>
      bordaTally(THREE, [
        ballot("v1", "a", "b", "c"),
        ballot("v2", "a", "kfc"),
      ]),
    ).toThrow();
  });

  test("test_REQ_107_throws_for_the_same_id_ranked_twice_on_one_ballot", () => {
    expect(() => bordaTally(THREE, VALID_BALLOTS)).not.toThrow();
    expect(() =>
      bordaTally(THREE, [
        ballot("v1", "a", "b", "c"),
        ballot("v2", "a", "b", "a"),
      ]),
    ).toThrow();
  });
});
