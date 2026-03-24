// src/components/HostScreen.jsx

import { useState, useEffect, useRef, useMemo } from 'react';
import { CATEGORIES } from '../lib/quizSets';
import { getNextSetForCategory, getQuizSetById } from '../lib/quizSelector';
import { calculateResult } from '../lib/winnerLogic';
import { serverNow } from '../lib/serverClock';
import { CODE_LENGTH } from '../lib/constants';
import {
  createRoom,
  resetRoom,
  listenToRoom,
  startQuestion,
  saveResult,
  verifyHostToken,
  getPlayers,
} from '../lib/realtimeDb';

// ─── Session persistence (survives page refresh, lost on tab close) ───────────

const HOST_SESSION_KEY = 'quiz_host_session';

function loadHostSession() {
  try { return JSON.parse(sessionStorage.getItem(HOST_SESSION_KEY)); }
  catch { return null; }
}

function saveHostSession(roomCode, hostToken, category) {
  sessionStorage.setItem(HOST_SESSION_KEY, JSON.stringify({ roomCode, hostToken, category }));
}

function clearHostSession() {
  sessionStorage.removeItem(HOST_SESSION_KEY);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getPlayerName(players, playerId) {
  return players?.[playerId]?.name ?? 'Unknown';
}

/** Format milliseconds as seconds with 2 decimals, e.g. "8.42s" */
function formatDuration(ms) {
  if (!ms || ms <= 0) return '–';
  return (ms / 1000).toFixed(2) + 's';
}

/**
 * Sort submissions into a ranked display order:
 *  1. Eligible, by score desc then totalTimeMs asc
 *  2. Ineligible, by answeredCount desc
 */
function rankSubmissions(submissions, winnerId) {
  const entries = Object.entries(submissions || {}).map(([id, s]) => ({ id, ...s }));
  entries.sort((a, b) => {
    // Winner always first
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    // Eligible before ineligible
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    // Among eligible: higher score first, then lower totalTimeMs
    if (a.eligible && b.eligible) {
      if (a.score !== b.score) return b.score - a.score;
      return a.totalTimeMs - b.totalTimeMs;
    }
    // Among ineligible: more answered first
    return b.answeredCount - a.answeredCount;
  });
  return entries;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HostScreen({ onBack }) {
  const storedSession = useMemo(loadHostSession, []);

  const [step, setStep] = useState(() => storedSession ? 'loading' : 'setup');
  const [roomCode, setRoomCode] = useState(() => storedSession?.roomCode ?? generateRoomCode());
  const [selectedCategory, setSelectedCategory] = useState(() => storedSession?.category ?? CATEGORIES[0].id);
  const [hostToken] = useState(() => storedSession?.hostToken ?? crypto.randomUUID());

  const [room, setRoom] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);

  // ── Auto-reconnect on mount ────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'loading' || !storedSession) return;

    verifyHostToken(storedSession.roomCode, storedSession.hostToken)
      .then((valid) => {
        if (valid) setStep('game');
        else { clearHostSession(); setStep('setup'); }
      })
      .catch(() => { clearHostSession(); setStep('setup'); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to Firebase room
  useEffect(() => {
    if (step !== 'game') return;
    return listenToRoom(roomCode, setRoom);
  }, [step, roomCode]);

  // ── Question countdown & auto-advance ──────────────────────────────────
  useEffect(() => {
    if (room?.stage !== 'question' || !room?.questionEndsAt) return;

    const qIdx = room.questionIndex;
    let advanced = false;

    const advance = async () => {
      if (advanced) return;
      advanced = true;
      try {
        if (qIdx >= CODE_LENGTH - 1) {
          // Last question done → compute result immediately
          await computeAndSaveResult();
        } else {
          await startQuestion(roomCode, qIdx + 1, hostToken);
        }
      } catch (e) { console.error('Auto-advance error:', e); }
    };

    const tick = () => {
      const rem = Math.ceil((room.questionEndsAt - serverNow()) / 1000);
      setCountdown(Math.max(0, rem));
      if (rem <= 0) advance();
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [room?.stage, room?.questionIndex, room?.questionEndsAt, roomCode, hostToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Result computation ─────────────────────────────────────────────────

  async function computeAndSaveResult() {
    const r = roomRef.current;
    const quizSet = getQuizSetById(r?.setId);
    if (!quizSet) return;

    const freshPlayers = await getPlayers(roomCode);
    const correctCode = quizSet.questions.map((q) => String(q.answer)).join('');
    const gameStartedAt = r?.gameStartedAt || 0;
    const result = calculateResult(freshPlayers, correctCode, gameStartedAt);

    const finalistsMap = result.finalists.reduce((acc, f) => ({ ...acc, [f.id]: true }), {});

    // Build submissions snapshot with full timing data
    const submissions = {};
    for (const s of result.allScored) {
      submissions[s.id] = {
        name: s.name,
        code: s.code,
        score: s.score,
        answeredCount: s.answeredCount,
        eligible: s.eligible,
        completedAt: s.completedAt,
        totalTimeMs: s.totalTimeMs,
      };
    }

    let message = 'Nobody eligible to win!';
    if (result.winner) {
      message = `${result.winner.name} wins!`;
    }

    await saveResult(roomCode, {
      correctCode,
      chosenPlayerId: result.winner?.id ?? null,
      finalists: finalistsMap,
      submissions,
      message,
      type: result.type,
    }, hostToken);
  }

  // ── Handlers ───────────────────────────────────────────────────────────

  async function handleCreate() {
    const code = roomCode.trim().toUpperCase();
    if (code.length < 2) { setError('Room code must be at least 2 characters.'); return; }
    if (!selectedCategory) { setError('Please select an audience type.'); return; }

    const setId = getNextSetForCategory(selectedCategory);

    setLoading(true);
    setError('');
    const err = await createRoom(code, setId, hostToken);
    setLoading(false);

    if (err) { setError(err); return; }

    setRoomCode(code);
    saveHostSession(code, hostToken, selectedCategory);
    setStep('game');
  }

  async function handleStartRound() {
    try { await startQuestion(roomCode, 0, hostToken); }
    catch (e) { setError(e.message); }
  }

  async function handleSkip() {
    try {
      if (room?.stage === 'question') {
        const idx = room.questionIndex ?? 0;
        if (idx >= CODE_LENGTH - 1) await computeAndSaveResult();
        else await startQuestion(roomCode, idx + 1, hostToken);
      }
    } catch (e) { setError(e.message); }
  }

  async function handleReset() {
    if (!window.confirm('Restart the game? All players will be removed and must rejoin.')) return;
    try {
      await resetRoom(roomCode, hostToken);
    } catch (e) { setError(e.message); return; }

    clearHostSession();
    setRoom(null);
    setRoomCode(generateRoomCode());
    setSelectedCategory(CATEGORIES[0].id);
    setError('');
    setStep('setup');
  }

  // ── Derived data ───────────────────────────────────────────────────────

  const quizSet = room?.setId ? getQuizSetById(room.setId) : null;
  const currentQuestion = quizSet?.questions[room?.questionIndex ?? 0] ?? null;
  const players = room?.players
    ? Object.entries(room.players).map(([id, p]) => ({ id, ...p }))
    : [];

  // ── RENDER: Loading ────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div className="screen host-screen">
        <div className="setup-card" style={{ textAlign: 'center' }}>
          <div className="status-icon">⏳</div>
          <h2 className="setup-title">Reconnecting…</h2>
          <p className="muted">Restoring your host session</p>
        </div>
      </div>
    );
  }

  // ── RENDER: Setup ──────────────────────────────────────────────────────

  if (step === 'setup') {
    return (
      <div className="screen host-screen">
        <div className="setup-card">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h2 className="setup-title">Host Setup</h2>

          <div className="form-group">
            <label>Room Code</label>
            <div className="room-code-row">
              <input
                className="input"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="e.g. QUIZ1"
              />
              <button className="btn btn-secondary" onClick={() => setRoomCode(generateRoomCode())}>
                🔄
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Audience Type</label>
            <div className="set-list">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={`btn btn-set ${selectedCategory === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button
            className="btn btn-primary btn-large"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create Room →'}
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Game ───────────────────────────────────────────────────────

  const stage = room?.stage ?? 'waiting';

  return (
    <div className="screen host-screen">

      {/* ── Waiting ── */}
      {stage === 'waiting' && (
        <div className="stage-waiting">
          <p className="stage-label">Waiting for players</p>
          <div className="room-code-display">{roomCode}</div>
          <p className="room-code-hint">Players enter this code on their phones</p>

          <div className="player-list">
            <p className="player-list-title">Players ({players.length} / 5)</p>
            {players.length === 0 && <p className="muted">No players yet…</p>}
            {players.map((p) => (
              <div key={p.id} className="player-item">
                <span className="player-dot" />
                {p.name}
              </div>
            ))}
          </div>

          <div className="host-actions">
            <button
              className="btn btn-primary btn-large"
              onClick={handleStartRound}
              disabled={players.length === 0}
            >
              Start Round
            </button>
            <button className="btn btn-ghost" onClick={onBack}>← Exit</button>
          </div>
          {error && <p className="error-msg">{error}</p>}
        </div>
      )}

      {/* ── Question ── */}
      {stage === 'question' && currentQuestion && (
        <div className="stage-question">
          <div className="question-header">
            <span className="question-number">
              Question {(room.questionIndex ?? 0) + 1} of {quizSet.questions.length}
            </span>
            <div className={`countdown ${countdown <= 3 ? 'countdown-urgent' : ''}`}>
              {countdown}s
            </div>
          </div>

          <h2 className="question-text">{currentQuestion.text}</h2>

          <div className="options-grid">
            {currentQuestion.options.map((opt, i) => (
              <div key={i} className={`option-card option-${i + 1}`}>
                <span className="option-num">{i + 1}</span>
                <span className="option-text">{opt}</span>
              </div>
            ))}
          </div>

          <div className="host-actions">
            <button className="btn btn-secondary" onClick={handleSkip}>
              Skip →
            </button>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {stage === 'result' && room?.result && (() => {
        const res = room.result;
        const ranked = rankSubmissions(res.submissions, res.chosenPlayerId);
        return (
          <div className="stage-result">
            <p className="result-label">CORRECT CODE</p>
            <div className="correct-code-display">
              {res.correctCode.split('').map((d, i) => (
                <span key={i} className="code-digit">{d}</span>
              ))}
            </div>

            {res.chosenPlayerId ? (
              <>
                <div className="winner-banner">
                  🏆 {getPlayerName(room.players, res.chosenPlayerId)}
                </div>
                <p className="result-type-label">
                  {res.type === 'exact' && 'Exact match!'}
                  {res.type === 'exact_speed' && 'Exact match — fastest player wins!'}
                  {res.type === 'exact_random' && 'Exact match — tied on speed, random pick'}
                  {res.type === 'partial' && 'Closest answer wins'}
                  {res.type === 'partial_speed' && 'Closest answer — fastest player wins!'}
                  {res.type === 'partial_random' && 'Closest answer — tied on speed, random pick'}
                </p>
              </>
            ) : (
              <div className="no-winner">No winner this round</div>
            )}

            <div className="leaderboard" style={{ width: '100%', maxWidth: 640 }}>
              <p className="submissions-title">LEADERBOARD</p>
              {ranked.map((s, rank) => {
                const isWinner = s.id === res.chosenPlayerId;
                const codeDisplay = s.code.replace(/-/g, '–');
                return (
                  <div
                    key={s.id}
                    className={`submission-row ${isWinner ? 'submission-winner' : ''}`}
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '12px 16px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                        {rank + 1}. {s.name} {isWinner ? '🏆' : ''}
                      </span>
                      <span className="submission-code">{codeDisplay}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.85rem' }}>
                      <span>
                        Score: <strong style={{ color: s.eligible && s.score === CODE_LENGTH ? 'var(--green)' : 'var(--text)' }}>
                          {s.eligible ? `${s.score}/${CODE_LENGTH}` : `${s.answeredCount}/${CODE_LENGTH} answered`}
                        </strong>
                      </span>
                      <span>
                        Time: <strong>{formatDuration(s.totalTimeMs)}</strong>
                      </span>
                      <span>
                        Eligible: <strong style={{ color: s.eligible ? 'var(--green)' : 'var(--red)' }}>
                          {s.eligible ? 'Yes' : 'No'}
                        </strong>
                      </span>
                      {!s.eligible && (
                        <span style={{ color: 'var(--red)' }}>INCOMPLETE</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="host-actions">
              <button className="btn btn-primary btn-large" onClick={handleReset}>
                🔄 Reset Room
              </button>
            </div>
            {error && <p className="error-msg">{error}</p>}
          </div>
        );
      })()}
    </div>
  );
}
