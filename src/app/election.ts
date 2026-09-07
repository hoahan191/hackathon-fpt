import type { Ballot, Restaurant, TallyResult } from "../types";
import type { ActivityLog } from "../log/activityLog";
import { bordaTally } from "../engine/tally";

/** REQ-111: the actor recorded against a tally, which no human performs. */
export const SYSTEM_ACTOR = "system:election";

export interface ElectionOptions {
  candidates: Restaurant[];
  log: ActivityLog;
}

export interface Election {
  /** REQ-107/REQ-111: validates against the candidate list, then records 'vote.recorded'. */
  castBallot(ballot: Ballot): void;
  ballots(): readonly Ballot[];
  /** REQ-101..REQ-106/REQ-111: runs bordaTally, then records 'tally.completed'. */
  tally(): TallyResult;
}

export function createElection(options: ElectionOptions): Election {
  const { candidates, log } = options;
  const candidateIds = new Set(candidates.map((c) => c.id));
  const cast: Ballot[] = [];

  return {
    castBallot(ballot) {
      // REQ-107/REQ-111: validate before anything is kept or recorded.
      const seen = new Set<string>();
      for (const id of ballot.rankings) {
        if (!candidateIds.has(id)) {
          throw new Error(`election: ${id} is not a candidate`);
        }
        if (seen.has(id)) {
          throw new Error(`election: ${id} is ranked twice on one ballot`);
        }
        seen.add(id);
      }

      // REQ-111: the log is the gate — a ballot it refuses is never retained.
      log.record({
        actor: ballot.voterId,
        action: "vote.recorded",
        metadata: { rankings: [...ballot.rankings] },
      });
      cast.push({ voterId: ballot.voterId, rankings: [...ballot.rankings] });
    },

    ballots() {
      return cast.map((b) => ({ ...b, rankings: [...b.rankings] }));
    },

    tally() {
      const result = bordaTally(candidates, cast);
      log.record({
        actor: SYSTEM_ACTOR,
        action: "tally.completed",
        metadata: {
          winnerId: result.winner.id,
          consensusMargin: result.consensusMargin,
        },
      });
      return result;
    },
  };
}
