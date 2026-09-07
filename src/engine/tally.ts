import type { Ballot, Restaurant, TallyResult } from "../types";

/** REQ-101..REQ-107: pure Borda count. No clock, no randomness, no I/O. */
export function bordaTally(
  candidates: Restaurant[],
  ballots: Ballot[],
): TallyResult {
  // REQ-106
  if (candidates.length === 0 || ballots.length === 0) {
    throw new Error(
      "tally: an election needs at least one candidate and one ballot",
    );
  }
  if (ballots.every((b) => b.rankings.length === 0)) {
    throw new Error("tally: every ballot is empty");
  }

  const n = candidates.length;
  const scores: Record<string, number> = {};
  const firstChoices: Record<string, number> = {};
  for (const c of candidates) {
    scores[c.id] = 0;
    firstChoices[c.id] = 0;
  }

  for (const { rankings } of ballots) {
    const seen = new Set<string>();
    rankings.forEach((id, i) => {
      // REQ-107
      if (!Object.hasOwn(scores, id)) {
        throw new Error(`tally: ${id} is not a candidate`);
      }
      if (seen.has(id)) {
        throw new Error(`tally: ${id} is ranked twice on one ballot`);
      }
      seen.add(id);
      // REQ-101/REQ-102: unranked candidates simply receive nothing.
      scores[id] += n - 1 - i;
    });
    if (rankings.length > 0) firstChoices[rankings[0]] += 1;
  }

  // REQ-103: total order, so ballot arrival order cannot affect the winner.
  const [winner, runnerUp] = [...candidates].sort(
    (a, b) =>
      scores[b.id] - scores[a.id] ||
      firstChoices[b.id] - firstChoices[a.id] ||
      a.id.localeCompare(b.id),
  );

  // REQ-104/REQ-105: one candidate has no runner-up and no obtainable score.
  const maxObtainable = ballots.length * (n - 1);
  const consensusMargin =
    maxObtainable === 0
      ? 1
      : (scores[winner.id] - scores[runnerUp.id]) / maxObtainable;

  return { winner, scores, consensusMargin };
}
