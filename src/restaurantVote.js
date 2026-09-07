export function pickRestaurant({ options, ballots }) {
  validateVote(options, ballots);

  const scores = Object.fromEntries(options.map((option) => [option, 0]));
  const firstPlaceVotes = Object.fromEntries(options.map((option) => [option, 0]));
  const lastRank = options.length - 1;

  for (const ballot of ballots) {
    ballot.rankings.forEach((option, index) => {
      scores[option] += lastRank - index;
    });
    firstPlaceVotes[ballot.rankings[0]] += 1;
  }

  const rankedOptions = [...options].sort((left, right) => {
    const scoreOrder = scores[right] - scores[left];
    if (scoreOrder !== 0) {
      return scoreOrder;
    }

    const firstPlaceOrder = firstPlaceVotes[right] - firstPlaceVotes[left];
    if (firstPlaceOrder !== 0) {
      return firstPlaceOrder;
    }

    return options.indexOf(left) - options.indexOf(right);
  });

  const winner = rankedOptions[0];
  const tiedOnPoints = rankedOptions.filter((option) => scores[option] === scores[winner]);
  const explanation = explainWinner(winner, scores, firstPlaceVotes, tiedOnPoints);

  return { winner, scores, firstPlaceVotes, explanation };
}

function validateVote(options, ballots) {
  if (!Array.isArray(options) || options.length < 2) {
    throw new Error('At least two restaurant options are required');
  }
  if (!Array.isArray(ballots) || ballots.length === 0) {
    throw new Error('At least one ballot is required');
  }

  const expected = [...options].sort();
  for (const ballot of ballots) {
    const rankings = Array.isArray(ballot.rankings) ? ballot.rankings : [];
    const rankedOptions = [...rankings].sort();
    if (rankings.length !== options.length || rankedOptions.some((option, index) => option !== expected[index])) {
      throw new Error('Each voter must rank every option exactly once');
    }
  }
}

function explainWinner(winner, scores, firstPlaceVotes, tiedOnPoints) {
  if (tiedOnPoints.length === 1) {
    return `${winner} won with ${scores[winner]} points.`;
  }

  const bestFirstPlaceCount = Math.max(...tiedOnPoints.map((option) => firstPlaceVotes[option]));
  const tiedAfterFirstPlace = tiedOnPoints.filter((option) => firstPlaceVotes[option] === bestFirstPlaceCount);
  if (tiedAfterFirstPlace.length === 1) {
    return `${winner} tied on points with ${scores[winner]} points, then won with ${firstPlaceVotes[winner]} first-place votes.`;
  }

  return `${winner} tied on points with ${scores[winner]} points and first-place votes, then won by original option order.`;
}