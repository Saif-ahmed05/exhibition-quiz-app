// src/lib/realtimeDb.js
// All Firebase Realtime Database helper functions.
//
// HOST PROTECTION MODEL
// ─────────────────────
// Firebase rules enforce structure (field types, immutable hostToken).
// Host-only operations (stage changes, result saving, etc.) are protected at
// the application layer: every host function calls assertHost() which reads the
// stored hostToken from Firebase and compares it to the token the host holds in
// sessionStorage. An attacker without the token cannot trigger host operations.

import { db } from '../firebase';
import {
  ref,
  set,
  get,
  update,
  onValue,
  off,
  runTransaction,
  serverTimestamp,
} from 'firebase/database';
import { MAX_PLAYERS, QUESTION_DURATION_MS } from './constants';
import { serverNow } from './serverClock';

// ─── HOST AUTH (application layer) ───────────────────────────────────────────

/**
 * Verify that hostToken matches the one stored in Firebase for this room.
 * Returns true/false.
 */
export async function verifyHostToken(roomCode, hostToken) {
  if (!hostToken) return false;
  const snap = await get(ref(db, `rooms/${roomCode}/hostToken`));
  return snap.exists() && snap.val() === hostToken;
}

/**
 * Throws if the hostToken is invalid. Call before every host write.
 */
async function assertHost(roomCode, hostToken) {
  const valid = await verifyHostToken(roomCode, hostToken);
  if (!valid) throw new Error('Unauthorized: invalid host token.');
}

// ─── ROOM ────────────────────────────────────────────────────────────────────

/**
 * Create a new room. Returns null on success, error string on failure.
 */
export async function createRoom(roomCode, setId, hostToken) {
  if (!hostToken) return 'Missing host token.';
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snap = await get(roomRef);
  if (snap.exists()) return 'A room with that code already exists.';

  await set(roomRef, {
    roomCode,
    stage: 'waiting',
    setId,
    questionIndex: 0,
    questionEndsAt: null,
    hostToken,
    roundId: 1,
    createdAt: serverTimestamp(),
    players: {},
    result: null,
  });
  return null;
}

/**
 * Reset a room back to waiting state.
 */
export async function resetRoom(roomCode, hostToken, newSetId) {
  await assertHost(roomCode, hostToken);

  const roundSnap = await get(ref(db, `rooms/${roomCode}/roundId`));
  const currentRound = roundSnap.exists() ? roundSnap.val() : 0;

  const updates = {
    stage: 'waiting',
    questionIndex: 0,
    questionEndsAt: null,
    result: null,
    roundId: currentRound + 1,
  };

  if (newSetId) updates.setId = newSetId;

  await update(ref(db, `rooms/${roomCode}`), updates);
  await set(ref(db, `rooms/${roomCode}/players`), null);
}

// ─── PLAYERS ─────────────────────────────────────────────────────────────────

/**
 * Join a room using a Firebase transaction to atomically enforce:
 *   - room exists and is in "waiting" stage
 *   - max 5 players
 *   - no duplicate names
 * Player structure now includes an `answers` map (one entry per question).
 * Returns null on success, error string on failure.
 */
export async function joinRoom(roomCode, playerId, playerName) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const existsSnap = await get(roomRef);
  if (!existsSnap.exists()) return 'Room not found.';

  let errorMsg = null;

  const { committed } = await runTransaction(roomRef, (room) => {
    if (!room) return room;

    if (room.stage !== 'waiting') { errorMsg = 'The game has already started.'; return; }

    const players = room.players || {};
    const playerList = Object.values(players);

    if (playerList.length >= MAX_PLAYERS) {
      errorMsg = `Room is full (max ${MAX_PLAYERS} players).`;
      return;
    }

    const trimmedName = playerName.trim();
    if (playerList.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      errorMsg = 'That name is already taken in this room.';
      return;
    }

    if (!room.players) room.players = {};
    room.players[playerId] = {
      name: trimmedName,
      joinedAt: Date.now(),
    };
    return room;
  });

  if (!committed && !errorMsg) errorMsg = 'Could not join. Please try again.';
  return errorMsg;
}

/**
 * Check whether a player is still present in a room (for reconnect).
 */
export async function checkPlayerExists(roomCode, playerId) {
  const snap = await get(ref(db, `rooms/${roomCode}/players/${playerId}`));
  return snap.exists();
}

/**
 * Get the current roundId for a room.
 */
export async function getRoundId(roomCode) {
  const snap = await get(ref(db, `rooms/${roomCode}/roundId`));
  return snap.exists() ? snap.val() : null;
}

/**
 * Read the current players object directly from Firebase (fresh, not cached).
 */
export async function getPlayers(roomCode) {
  const snap = await get(ref(db, `rooms/${roomCode}/players`));
  return snap.exists() ? snap.val() : {};
}

// ─── PER-QUESTION ANSWER SUBMISSION ─────────────────────────────────────────

/**
 * Submit a single-question answer for a player.
 * Saves to: rooms/{roomCode}/players/{playerId}/answers/q{questionIndex}
 *
 * @param {string} roomCode
 * @param {string} playerId
 * @param {number} questionIndex  - 0-based question number
 * @param {string} digit          - single digit '0'-'9'
 * @returns {string|null}         - error string or null on success
 */
export async function submitAnswer(roomCode, playerId, questionIndex, digit) {
  if (typeof digit !== 'string' || digit.length !== 1 || !/^\d$/.test(digit)) {
    return 'Invalid answer. Enter a single digit (0–9).';
  }

  // Verify the room is on the correct question
  const snap = await get(ref(db, `rooms/${roomCode}`));
  if (!snap.exists()) return 'Room not found.';
  const room = snap.val();
  if (room.stage !== 'question') return 'Question is not active right now.';
  if (room.questionIndex !== questionIndex) return 'Wrong question index.';

  const answerPath = `rooms/${roomCode}/players/${playerId}/answers/q${questionIndex}`;

  // Check if already submitted for this question
  const existingSnap = await get(ref(db, answerPath));
  if (existingSnap.exists() && existingSnap.val()?.submitted) {
    return 'You already submitted for this question.';
  }

  await set(ref(db, answerPath), {
    value: digit,
    submittedAt: serverNow(),
    submitted: true,
  });

  return null;
}

// ─── GAMEPLAY ─────────────────────────────────────────────────────────────────

/**
 * Begin a question: sets stage, questionIndex, and a server-synced deadline.
 * When starting Q1 (index 0), also stores gameStartedAt for totalTimeMs computation.
 */
export async function startQuestion(roomCode, questionIndex, hostToken) {
  await assertHost(roomCode, hostToken);
  const updates = {
    stage: 'question',
    questionIndex,
    questionEndsAt: serverNow() + QUESTION_DURATION_MS,
  };
  // Record game start time on the first question
  if (questionIndex === 0) {
    updates.gameStartedAt = serverNow();
  }
  await update(ref(db, `rooms/${roomCode}`), updates);
}

/**
 * Move room directly to 'result' stage (skip the old code_entry phase).
 * The host calls this after the last question finishes.
 */
export async function showResult(roomCode, hostToken) {
  await assertHost(roomCode, hostToken);
  await update(ref(db, `rooms/${roomCode}`), { stage: 'result' });
}

/**
 * Save the calculated result and move room to "result" stage.
 */
export async function saveResult(roomCode, result, hostToken) {
  await assertHost(roomCode, hostToken);
  await set(ref(db, `rooms/${roomCode}/result`), result);
  await update(ref(db, `rooms/${roomCode}`), { stage: 'result' });
}

// ─── LISTENER ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to live room updates. Returns an unsubscribe function for
 * useEffect cleanup.
 */
export function listenToRoom(roomCode, callback) {
  const roomRef = ref(db, `rooms/${roomCode}`);
  onValue(roomRef, (snap) => callback(snap.exists() ? snap.val() : null));
  return () => off(roomRef);
}
