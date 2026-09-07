import test from 'node:test';
import assert from 'node:assert/strict';
import { pickRestaurant } from '../src/restaurantVote.js';

test('APP-001 picks the highest Borda score and explains the winning points', () => {
  const result = pickRestaurant({
    options: ['Pho Thin', 'Banh Mi Huynh Hoa', 'Com Tam Ba Ghien'],
    ballots: [
      { voter: 'Mai', rankings: ['Pho Thin', 'Banh Mi Huynh Hoa', 'Com Tam Ba Ghien'] },
      { voter: 'Linh', rankings: ['Com Tam Ba Ghien', 'Pho Thin', 'Banh Mi Huynh Hoa'] },
      { voter: 'An', rankings: ['Pho Thin', 'Com Tam Ba Ghien', 'Banh Mi Huynh Hoa'] },
    ],
  });

  assert.equal(result.winner, 'Pho Thin');
  assert.deepEqual(result.scores, {
    'Pho Thin': 5,
    'Com Tam Ba Ghien': 3,
    'Banh Mi Huynh Hoa': 1,
  });
  assert.match(result.explanation, /Pho Thin won with 5 points/i);
});

test('APP-002 breaks score ties by most first-place votes, then option order', () => {
  const result = pickRestaurant({
    options: ['Pho Thin', 'Banh Mi Huynh Hoa', 'Com Tam Ba Ghien'],
    ballots: [
      { voter: 'Mai', rankings: ['Pho Thin', 'Banh Mi Huynh Hoa', 'Com Tam Ba Ghien'] },
      { voter: 'Linh', rankings: ['Banh Mi Huynh Hoa', 'Com Tam Ba Ghien', 'Pho Thin'] },
      { voter: 'An', rankings: ['Com Tam Ba Ghien', 'Pho Thin', 'Banh Mi Huynh Hoa'] },
    ],
  });

  assert.equal(result.winner, 'Pho Thin');
  assert.match(result.explanation, /tied on points/i);
  assert.match(result.explanation, /original option order/i);
});

test('APP-003 rejects incomplete ballots so every voter ranks every option once', () => {
  assert.throws(
    () =>
      pickRestaurant({
        options: ['Pho Thin', 'Banh Mi Huynh Hoa'],
        ballots: [{ voter: 'Mai', rankings: ['Pho Thin'] }],
      }),
    /rank every option/i,
  );
});