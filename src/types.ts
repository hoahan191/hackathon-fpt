// Domain contracts. Shared by the tally engine, the explainer, the activity log and the UI.

export interface Restaurant {
  id: string;
  name: string;
  cuisine?: string;
  priceLevel?: number;
}

export interface Ballot {
  voterId: string;
  /** Ordered restaurant ids, index 0 = 1st choice. May omit candidates. */
  rankings: string[];
}

export interface TallyResult {
  winner: Restaurant;
  scores: Record<string, number>;
  /** (winner - runner-up) / max obtainable score, in [0, 1]. */
  consensusMargin: number;
  roundsSummary?: string[];
}

export interface ExplainResponse {
  winnerId: string;
  explanation: string;
  highlights: string[];
}

/** REQ-110: an optional model. Absent means the deterministic text stands alone. */
export interface LlmClient {
  complete(prompt: string): Promise<string>;
}

// --- Activity log (spec/activity-log.md) ---

/** REQ-007: time comes from the caller, never from the system clock. */
export type Clock = () => number;

export interface ActivityInput {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityEntry {
  actor: string;
  action: string;
  timestamp: number;
  metadata: Record<string, unknown>;
  /** REQ-003: store-assigned insertion order. Total, stable, never caller-supplied. */
  seq: number;
}

export interface QueryResult {
  entries: ActivityEntry[];
  /** REQ-006: false means this actor has never been seen, not merely idle. */
  actorKnown: boolean;
}

/** REQ-005: inclusive at both bounds. */
export interface TimeRange {
  start: number;
  end: number;
}
