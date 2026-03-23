// src/lib/quizSelector.js
// Non-repeating quiz set rotation per category.
//
// Tracks which sets have been used for each category in sessionStorage.
// When all sets in a category are exhausted, resets history and starts over
// (avoiding the last-used set on the first pick of the new cycle).

import { QUIZ_SETS } from './quizSets';

const HISTORY_KEY = 'quiz_category_history';

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadHistory() {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY)) ?? {}; }
  catch { return {}; }
}

function saveHistory(history) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ─── Selector ─────────────────────────────────────────────────────────────────

/**
 * Pick the next quiz set for a category, avoiding immediate repeats.
 *
 * @param {string} categoryId  - e.g. 'technical', 'normal', 'students'
 * @returns {string} The chosen set's unique id (e.g. 'students_3')
 */
export function getNextSetForCategory(categoryId) {
  const allSets = QUIZ_SETS.filter((s) => s.category === categoryId);
  if (allSets.length === 0) throw new Error(`No sets for category "${categoryId}"`);
  if (allSets.length === 1) return allSets[0].id;

  const allIds = allSets.map((s) => s.id);
  const history = loadHistory();
  const used = history[categoryId] ?? [];

  // IDs not yet used this cycle
  let available = allIds.filter((id) => !used.includes(id));

  if (available.length === 0) {
    // All sets exhausted — reset, but avoid the very last one used
    const lastUsed = used[used.length - 1];
    available = allIds.filter((id) => id !== lastUsed);
    // Edge case: if filtering leaves nothing (shouldn't happen with >1 set), use all
    if (available.length === 0) available = allIds;
    // Reset history for this category
    history[categoryId] = [];
  }

  // Pick randomly from available
  const chosen = available[Math.floor(Math.random() * available.length)];

  // Record usage
  history[categoryId] = [...(history[categoryId] ?? []), chosen];
  saveHistory(history);

  return chosen;
}

/**
 * Look up a quiz set by its unique ID.
 * @param {string} setId - e.g. 'technical_2'
 * @returns {object|undefined}
 */
export function getQuizSetById(setId) {
  return QUIZ_SETS.find((s) => s.id === setId);
}
