export class ActivityLog {
  constructor(clock) {
    this.clock = clock;
    this.entries = [];
    this.nextSequence = 0;
  }

  record(actor, action, metadata = {}) {
    if (!actor) {
      throw new Error('actor is required');
    }
    if (!action) {
      throw new Error('action is required');
    }

    const entry = {
      actor,
      action,
      timestamp: this.clock(),
      metadata: redactMetadata(metadata),
      sequence: this.nextSequence,
    };

    this.nextSequence += 1;
    this.entries.push(entry);
    return withoutSequence(entry);
  }

  queryByActor(actor) {
    return this.entries
      .filter((entry) => entry.actor === actor)
      .sort(compareEntries)
      .map(withoutSequence);
  }

  queryByTimeRange(start, end) {
    return this.entries
      .filter((entry) => entry.timestamp >= start && entry.timestamp <= end)
      .sort(compareEntries)
      .map(withoutSequence);
  }
}

function compareEntries(left, right) {
  const timestampOrder = right.timestamp - left.timestamp;
  if (timestampOrder !== 0) {
    return timestampOrder;
  }
  return right.sequence - left.sequence;
}

function redactMetadata(metadata) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, isSensitiveKey(key) ? '[REDACTED]' : value]),
  );
}

function isSensitiveKey(key) {
  return /password|token|secret|apikey|authorization|creditcard|phone/i.test(key);
}

function withoutSequence(entry) {
  const { sequence, ...publicEntry } = entry;
  return publicEntry;
}