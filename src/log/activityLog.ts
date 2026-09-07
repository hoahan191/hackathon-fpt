import type {
  ActivityEntry,
  ActivityInput,
  Clock,
  QueryResult,
  TimeRange,
} from "../types";

export interface ActivityLog {
  /** REQ-001/REQ-002: stores a valid entry, throws on an invalid one. */
  record(input: ActivityInput): ActivityEntry;
  /** REQ-003/REQ-006: newest first, with a flag saying whether the actor is known. */
  queryByActor(actor: string, range?: TimeRange): QueryResult;
  /** REQ-005: inclusive at both bounds. */
  queryByTimeRange(start: number, end: number): ActivityEntry[];
}

export interface ActivityLogOptions {
  /** REQ-007: the only time source. */
  clock: Clock;
  /** REQ-004: extra key names to redact, on top of the default deny-list. */
  sensitiveKeys?: string[];
}

const DEFAULT_SENSITIVE_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "apiKey",
  "otp",
  "pin",
  "cvv",
  "cardNumber",
  "ssn",
];

const REDACTED = "[REDACTED]";

export function createActivityLog(options: ActivityLogOptions): ActivityLog {
  const { clock, sensitiveKeys = [] } = options;
  const denyList = new Set(
    [...DEFAULT_SENSITIVE_KEYS, ...sensitiveKeys].map((k) => k.toLowerCase()),
  );

  const entries: ActivityEntry[] = [];
  const knownActors = new Set<string>();
  let nextSeq = 0;

  /** REQ-004: the key name decides, at every depth, and the copy is fresh throughout. */
  function redact(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(redact);
    }
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(
        value as Record<string, unknown>,
      )) {
        out[key] = denyList.has(key.toLowerCase()) ? REDACTED : redact(nested);
      }
      return out;
    }
    return value;
  }

  function deepCopy(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(deepCopy);
    }
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(
        value as Record<string, unknown>,
      )) {
        out[key] = deepCopy(nested);
      }
      return out;
    }
    return value;
  }

  function copy(entry: ActivityEntry): ActivityEntry {
    return {
      ...entry,
      metadata: deepCopy(entry.metadata) as Record<string, unknown>,
    };
  }

  /** REQ-003: newest timestamp first, then highest seq first. Total and stable. */
  function newestFirst(a: ActivityEntry, b: ActivityEntry): number {
    return b.timestamp - a.timestamp || b.seq - a.seq;
  }

  function inRange(entry: ActivityEntry, range: TimeRange): boolean {
    return entry.timestamp >= range.start && entry.timestamp <= range.end;
  }

  return {
    record(input) {
      const actor = typeof input?.actor === "string" ? input.actor.trim() : "";
      const action =
        typeof input?.action === "string" ? input.action.trim() : "";
      if (actor === "" || action === "") {
        throw new Error("activity log: actor and action must be non-empty");
      }

      const entry: ActivityEntry = {
        actor,
        action,
        timestamp: clock(),
        metadata: redact(input.metadata ?? {}) as Record<string, unknown>,
        seq: nextSeq++,
      };
      entries.push(entry);
      knownActors.add(actor);
      return copy(entry);
    },

    queryByActor(actor, range) {
      const matches = entries
        .filter((e) => e.actor === actor && (!range || inRange(e, range)))
        .sort(newestFirst)
        .map(copy);
      return { entries: matches, actorKnown: knownActors.has(actor) };
    },

    queryByTimeRange(start, end) {
      return entries
        .filter((e) => inRange(e, { start, end }))
        .sort(newestFirst)
        .map(copy);
    },
  };
}
