// src/lib/winnerLogic.js
// Pure winner-calculation logic — no Firebase imports here.

/**
 * Calculate the result of a round.
 *
 * @param {object} players  - players object from Firebase: { [id]: { name, submittedCode, ... } }
 * @param {string} correctCode - e.g. "2411"
 * @returns {{ finalists: Array, winner: object|null, type: string }}
 */
export function calculateResult(players, correctCode) {
  // Build a flat list of players who actually submitted
  const submissions = Object.entries(players || {})
    .filter(([, p]) => p.submittedCode !== null && p.submittedCode !== undefined)
    .map(([id, p]) => ({ id, name: p.name, code: p.submittedCode }));

  if (submissions.length === 0) {
    return { finalists: [], winner: null, type: 'no_submissions' };
  }

  // 1. Find exact matches
  const exactMatches = submissions.filter((s) => s.code === correctCode);

  if (exactMatches.length === 1) {
    return { finalists: exactMatches, winner: exactMatches[0], type: 'exact' };
  }

  if (exactMatches.length > 1) {
    const winner = pickRandom(exactMatches);
    return { finalists: exactMatches, winner, type: 'exact_random' };
  }

  // 2. No exact match — score each submission by correct digits in correct positions
  function positionalScore(code) {
    let score = 0;
    for (let i = 0; i < correctCode.length; i++) {
      if (code[i] === correctCode[i]) score++;
    }
    return score;
  }

  const scored = submissions.map((s) => ({ ...s, score: positionalScore(s.code) }));
  const maxScore = Math.max(...scored.map((s) => s.score));

  if (maxScore === 0) {
    return { finalists: [], winner: null, type: 'no_correct' };
  }

  const finalists = scored.filter((s) => s.score === maxScore);
  const winner = pickRandom(finalists);

  return { finalists, winner, type: 'partial' };
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
