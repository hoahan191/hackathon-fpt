import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityLog } from '../src/activityLog.js';

function fixedClock(times) {
  let index = 0;
  return () => times[index++];
}

test('REQ-001 records an entry and returns it in later queries', () => {
  const at = new Date('2026-09-07T09:00:00Z');
  const log = new ActivityLog(fixedClock([at]));

  log.record('mai', 'ranked_restaurants', { topChoice: 'Pho Thin' });

  assert.deepEqual(log.queryByActor('mai'), [
    {
      actor: 'mai',
      action: 'ranked_restaurants',
      timestamp: at,
      metadata: { topChoice: 'Pho Thin' },
    },
  ]);
});

test('REQ-002 rejects entries with empty actor or action and records nothing', () => {
  const log = new ActivityLog(fixedClock([new Date('2026-09-07T09:00:00Z')]));

  assert.throws(() => log.record('', 'ranked_restaurants'), /actor/i);
  assert.throws(() => log.record('mai', ''), /action/i);
  assert.deepEqual(log.queryByActor('mai'), []);
});

test('REQ-003 returns entries by actor most recent first with stable same-timestamp order', () => {
  const shared = new Date('2026-09-07T09:00:00Z');
  const later = new Date('2026-09-07T10:00:00Z');
  const log = new ActivityLog(fixedClock([shared, shared, later]));

  log.record('mai', 'opened_vote', { round: 1 });
  log.record('mai', 'ranked_restaurants', { topChoice: 'Com Tam Ba Ghien' });
  log.record('mai', 'picked_winner', { winner: 'Com Tam Ba Ghien' });

  const firstQuery = log.queryByActor('mai').map((entry) => entry.action);
  const secondQuery = log.queryByActor('mai').map((entry) => entry.action);

  assert.deepEqual(firstQuery, ['picked_winner', 'ranked_restaurants', 'opened_vote']);
  assert.deepEqual(secondQuery, firstQuery);
});

test('REQ-004 irreversibly redacts sensitive metadata by key before storage', () => {
  const log = new ActivityLog(fixedClock([new Date('2026-09-07T09:00:00Z')]));

  log.record('mai', 'shared_contact', {
    phone: '+84 900 000 000',
    ApiKey: 'abc123',
    note: 'likes noodles',
  });

  assert.deepEqual(log.queryByActor('mai')[0].metadata, {
    phone: '[REDACTED]',
    ApiKey: '[REDACTED]',
    note: 'likes noodles',
  });
});

test('REQ-005 returns entries inside an inclusive time range', () => {
  const start = new Date('2026-09-07T09:00:00Z');
  const middle = new Date('2026-09-07T09:30:00Z');
  const end = new Date('2026-09-07T10:00:00Z');
  const log = new ActivityLog(fixedClock([start, middle, end]));

  log.record('mai', 'opened_vote');
  log.record('linh', 'ranked_restaurants');
  log.record('an', 'picked_winner');

  assert.deepEqual(
    log.queryByTimeRange(start, end).map((entry) => entry.action),
    ['picked_winner', 'ranked_restaurants', 'opened_vote'],
  );
});

test('REQ-006 returns an empty array when actor or time range has no matches', () => {
  const log = new ActivityLog(fixedClock([new Date('2026-09-07T09:00:00Z')]));

  log.record('mai', 'opened_vote');

  assert.deepEqual(log.queryByActor('unknown'), []);
  assert.deepEqual(
    log.queryByTimeRange(new Date('2026-09-07T10:00:00Z'), new Date('2026-09-07T11:00:00Z')),
    [],
  );
});

test('REQ-007 uses caller-supplied time instead of reading the system clock', () => {
  const supplied = new Date('2026-09-07T09:00:00Z');
  const log = new ActivityLog(() => supplied);

  log.record('mai', 'opened_vote');

  assert.equal(log.queryByActor('mai')[0].timestamp, supplied);
});