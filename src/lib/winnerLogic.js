// src/lib/winnerLogic.js
// Pure winner-calculation logic — no Firebase imports here.

import { CODE_LENGTH } from './constants';

/**
 * Calculate the result of a round.
 *
 * @param {object} players      - players map from Firebase
 * @param {string} correctCode  - e.g. "2411"
 * @param {number} gameStartedAt - timestamp when Q1 started (for totalTimeMs)
 * @returns {{ finalists: Array, winner: object|null, type: string, allScored: Array }}
 *
 * Eligibility: must have submitted ALL questions.
 * Tie-break: highest score → lowest completedAt (millisecond precision) → random.
 */
export function calculateResult(players, correctCode, gameStartedAt) {
  const allScored = [];

  for (const [id, p] of Object.entries(players || {})) {
    const answers = p.answers || {};
    let answeredCount = 0;
    let code = '';
    let firstAnswerTime = Infinity;
    let completedAt = 0;

    for (let i = 0; i < CODE_LENGTH; i++) {
      const a = answers[`q${i}`];
      if (a && a.submitted) {
        answeredCount++;
        code += String(a.value);
        const t = a.submittedAt || 0;
        if (t < firstAnswerTime) firstAnswerTime = t;
        if (t > completedAt) completedAt = t;
      } else {
        code += '-';
      }
    }

    if (firstAnswerTime === Infinity) firstAnswerTime = 0;

    const eligible = answeredCount === CODE_LENGTH;

    // totalTimeMs: time from game start to last answer (if game start known),
    // otherwise from first answer to last answer
    let totalTimeMs = 0;
    if (eligible && completedAt > 0) {
      if (gameStartedAt && gameStartedAt > 0) {
        totalTimeMs = completedAt - gameStartedAt;
      } else if (firstAnswerTime > 0) {
        totalTimeMs = completedAt - firstAnswerTime;
      }
    }

    let score = 0;
    if (eligible) {
      for (let i = 0; i < CODE_LENGTH; i++) {
        if (code[i] === correctCode[i]) score++;
      }
    }

    allScored.push({
      id,
      name: p.name,
      code,
      answeredCount,
      eligible,
      score,
      completedAt,
      firstAnswerTime,
      totalTimeMs,
    });
  }

  // Only eligible players can win
  const eligiblePlayers = allScored.filter((s) => s.eligible);

  if (eligiblePlayers.length === 0) {
    return { finalists: [], winner: null, type: 'no_eligible', allScored };
  }

  const maxScore = Math.max(...eligiblePlayers.map((s) => s.score));

  if (maxScore === 0) {
    return { finalists: [], winner: null, type: 'no_correct', allScored };
  }

  const finalists = eligiblePlayers.filter((s) => s.score === maxScore);

  if (finalists.length === 1) {
    const type = maxScore === CODE_LENGTH ? 'exact' : 'partial';
    return { finalists, winner: finalists[0], type, allScored };
  }

  // Tie-break: earliest completedAt wins (millisecond precision)
  finalists.sort((a, b) => a.completedAt - b.completedAt);

  if (finalists[0].completedAt < finalists[1].completedAt) {
    const type = maxScore === CODE_LENGTH ? 'exact_speed' : 'partial_speed';
    return { finalists, winner: finalists[0], type, allScored };
  }

  // Exact same ms timestamp — random fallback
  const type = maxScore === CODE_LENGTH ? 'exact_random' : 'partial_random';
  return { finalists, winner: pickRandom(finalists), type, allScored };
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
