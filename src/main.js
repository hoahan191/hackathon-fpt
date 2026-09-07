import { ActivityLog } from './activityLog.js';
import { pickRestaurant } from './restaurantVote.js';

const defaultOptions = ['Pho Thin', 'Banh Mi Huynh Hoa', 'Com Tam Ba Ghien'];
const voters = ['Mai', 'Linh', 'An'];
let options = [...defaultOptions];
let ballots = [
  { voter: 'Mai', rankings: ['Pho Thin', 'Banh Mi Huynh Hoa', 'Com Tam Ba Ghien'] },
  { voter: 'Linh', rankings: ['Com Tam Ba Ghien', 'Pho Thin', 'Banh Mi Huynh Hoa'] },
  { voter: 'An', rankings: ['Pho Thin', 'Com Tam Ba Ghien', 'Banh Mi Huynh Hoa'] },
];

const log = new ActivityLog(() => new Date());
log.record('system', 'opened_vote', { options: options.length });

const optionsList = document.querySelector('#options-list');
const optionForm = document.querySelector('#option-form');
const optionName = document.querySelector('#option-name');
const ballotsContainer = document.querySelector('#ballots');
const decideButton = document.querySelector('#decide');
const resetButton = document.querySelector('#reset-demo');
const winner = document.querySelector('#winner');
const explanation = document.querySelector('#explanation');
const scoreboard = document.querySelector('#scoreboard');
const activityLog = document.querySelector('#activity-log');

render();

optionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = optionName.value.trim();
  if (!name || options.includes(name)) {
    return;
  }

  options = [...options, name];
  ballots = ballots.map((ballot) => ({ ...ballot, rankings: [...ballot.rankings, name] }));
  optionName.value = '';
  log.record('driver', 'added_restaurant', { restaurant: name });
  render();
});

resetButton.addEventListener('click', () => {
  options = [...defaultOptions];
  ballots = [
    { voter: 'Mai', rankings: ['Pho Thin', 'Banh Mi Huynh Hoa', 'Com Tam Ba Ghien'] },
    { voter: 'Linh', rankings: ['Com Tam Ba Ghien', 'Pho Thin', 'Banh Mi Huynh Hoa'] },
    { voter: 'An', rankings: ['Pho Thin', 'Com Tam Ba Ghien', 'Banh Mi Huynh Hoa'] },
  ];
  log.record('driver', 'reset_demo', { phone: '+84 demo redacted' });
  render();
});

decideButton.addEventListener('click', () => {
  try {
    const result = pickRestaurant({ options, ballots });
    winner.textContent = result.winner;
    explanation.textContent = result.explanation;
    renderScores(result.scores);
    log.record('driver', 'picked_winner', { winner: result.winner, scores: JSON.stringify(result.scores) });
  } catch (error) {
    winner.textContent = 'Fix the ballots';
    explanation.textContent = error.message;
    log.record('driver', 'validation_failed', { reason: error.message });
  }
  renderActivityLog();
});

function render() {
  renderOptions();
  renderBallots();
  renderScores(Object.fromEntries(options.map((option) => [option, 0])));
  renderActivityLog();
}

function renderOptions() {
  optionsList.replaceChildren(
    ...options.map((option) => {
      const item = document.createElement('div');
      item.className = 'option-pill';
      item.textContent = option;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.disabled = options.length <= 2;
      remove.addEventListener('click', () => removeOption(option));
      item.append(remove);

      return item;
    }),
  );
}

function removeOption(option) {
  options = options.filter((candidate) => candidate !== option);
  ballots = ballots.map((ballot) => ({
    ...ballot,
    rankings: ballot.rankings.filter((candidate) => candidate !== option),
  }));
  log.record('driver', 'removed_restaurant', { restaurant: option });
  render();
}

function renderBallots() {
  ballotsContainer.replaceChildren(
    ...ballots.map((ballot, ballotIndex) => {
      const card = document.createElement('article');
      card.className = 'ballot';

      const title = document.createElement('h3');
      title.textContent = ballot.voter;
      card.append(title, rankingControls(ballot, ballotIndex));
      return card;
    }),
  );
}

function rankingControls(ballot, ballotIndex) {
  const grid = document.createElement('div');
  grid.className = 'ranking-grid';

  ballot.rankings.forEach((selected, rankIndex) => {
    const label = document.createElement('label');
    const labelText = document.createElement('span');
    labelText.textContent = `Rank ${rankIndex + 1}`;

    const select = document.createElement('select');
    options.forEach((option) => {
      const choice = document.createElement('option');
      choice.value = option;
      choice.textContent = option;
      choice.selected = option === selected;
      select.append(choice);
    });
    select.addEventListener('change', () => updateRanking(ballotIndex, rankIndex, select.value));

    label.append(labelText, select);
    grid.append(label);
  });

  return grid;
}

function updateRanking(ballotIndex, rankIndex, value) {
  const ballot = ballots[ballotIndex];
  const previousIndex = ballot.rankings.indexOf(value);
  const nextRankings = [...ballot.rankings];
  nextRankings[previousIndex] = nextRankings[rankIndex];
  nextRankings[rankIndex] = value;
  ballots[ballotIndex] = { ...ballot, rankings: nextRankings };
  log.record(ballot.voter.toLowerCase(), 'ranked_restaurants', { topChoice: nextRankings[0] });
  renderBallots();
  renderActivityLog();
}

function renderScores(scores) {
  scoreboard.replaceChildren(
    ...Object.entries(scores).map(([restaurant, score]) => {
      const row = document.createElement('div');
      row.className = 'score-row';

      const name = document.createElement('dt');
      name.textContent = restaurant;

      const points = document.createElement('dd');
      points.textContent = score;

      row.append(name, points);
      return row;
    }),
  );
}

function renderActivityLog() {
  const entries = log.queryByTimeRange(new Date(0), new Date('9999-12-31T23:59:59Z'));
  activityLog.replaceChildren(
    ...entries.slice(0, 8).map((entry) => {
      const item = document.createElement('li');

      const title = document.createElement('strong');
      title.textContent = `${entry.actor} ${entry.action}`;

      const details = document.createElement('span');
      details.textContent = `${entry.timestamp.toLocaleTimeString()} | ${JSON.stringify(entry.metadata)}`;

      item.append(title, details);
      return item;
    }),
  );
}