// src/components/PlayerScreen.jsx

import { useState, useEffect, useRef } from 'react';
import { listenToRoom, joinRoom, submitAnswer, checkPlayerExists, getRoundId } from '../lib/realtimeDb';
import { serverNow } from '../lib/serverClock';
import { CODE_LENGTH } from '../lib/constants';

// ─── Safe UUID ──────────────────────────────────────────────────────────────────

function safeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
  }
}

// ─── Session persistence ──────────────────────────────────────────────────────

const PLAYER_SESSION_KEY = 'quiz_player_session';

function loadPlayerSession() {
  try {
    return JSON.parse(sessionStorage.getItem(PLAYER_SESSION_KEY));
  } catch {
    return null;
  }
}

function savePlayerSession(playerId, roomCode, playerName, roundId) {
  sessionStorage.setItem(
    PLAYER_SESSION_KEY,
    JSON.stringify({ playerId, roomCode, playerName, roundId, joined: true })
  );
}

function clearPlayerSession() {
  sessionStorage.removeItem(PLAYER_SESSION_KEY);
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(ms) {
  if (!ms || ms <= 0) return '–';
  return (ms / 1000).toFixed(2) + 's';
}

function rankSubmissions(submissions, winnerId) {
  const entries = Object.entries(submissions || {}).map(([id, s]) => ({ id, ...s }));
  entries.sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.eligible && b.eligible) {
      if (a.score !== b.score) return b.score - a.score;
      return a.totalTimeMs - b.totalTimeMs;
    }
    return b.answeredCount - a.answeredCount;
  });
  return entries;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlayerScreen({ onBack }) {
  const [storedSession] = useState(loadPlayerSession);

  const [phase, setPhase] = useState('loading');
  const [playerId] = useState(() => storedSession?.playerId ?? safeId());
  const [roomCode, setRoomCode] = useState(() => storedSession?.roomCode ?? '');
  const [playerName, setPlayerName] = useState(() => storedSession?.playerName ?? '');

  const [room, setRoom] = useState(null);
  const [digits, setDigits] = useState(() => Array(CODE_LENGTH).fill(''));
  const [submittedQs, setSubmittedQs] = useState(() => Array(CODE_LENGTH).fill(false));
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef(null);

  // ── Auto-reconnect on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!storedSession?.joined || !storedSession?.roomCode) {
      setPhase('join');
      return;
    }

    checkPlayerExists(storedSession.roomCode, storedSession.playerId)
      .then((exists) => {
        setPhase(exists ? 'game' : 'join');
      })
      .catch(() => {
        setPhase('join');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Firebase subscription ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'game' || !roomCode) return;
    return listenToRoom(roomCode, setRoom);
  }, [phase, roomCode]);

  // ── Detect round reset / player removal → kick back to join ───────────
  useEffect(() => {
    if (phase !== 'game' || !room) return;

    const savedSession = loadPlayerSession();
    const playerGone = !room.players?.[playerId];
    const roundChanged = savedSession?.roundId != null
      && room.roundId != null
      && savedSession.roundId !== room.roundId;

    if (playerGone || roundChanged) {
      clearPlayerSession();
      setRoom(null);
      setSubmittedQs(Array(CODE_LENGTH).fill(false));
      setDigits(Array(CODE_LENGTH).fill(''));
      setError('');
      setPhase('join');
    }
  }, [phase, room, playerId]);

  // ── Countdown ticker ──────────────────────────────────────────────────
  useEffect(() => {
    const endsAt = room?.stage === 'question' ? room.questionEndsAt : null;
    if (!endsAt) { setCountdown(0); return; }

    const tick = () =>
      setCountdown(Math.max(0, Math.ceil((endsAt - serverNow()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [room?.stage, room?.questionEndsAt]);

  // ── Recover submitted state from Firebase (survives player refresh) ───
  useEffect(() => {
    if (!room?.players?.[playerId]?.answers) return;
    const answers = room.players[playerId].answers;
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < CODE_LENGTH; i++) {
        const a = answers[`q${i}`];
        if (a?.submitted) next[i] = String(a.value);
      }
      return next;
    });
    setSubmittedQs((prev) => {
      const next = [...prev];
      for (let i = 0; i < CODE_LENGTH; i++) {
        const a = answers[`q${i}`];
        if (a?.submitted) next[i] = true;
      }
      return next;
    });
  }, [room?.players, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derive which box is currently active ──────────────────────────────
  const activeBox = (room?.stage === 'question') ? (room?.questionIndex ?? 0) : null;
  const isActiveSubmitted = activeBox !== null && submittedQs[activeBox];

  // ── Auto-focus input when active box changes ──────────────────────────
  useEffect(() => {
    if (activeBox !== null && !isActiveSubmitted) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [activeBox, isActiveSubmitted]);

  // ── Handlers ──────────────────────────────────────────────────────────

  async function handleJoin() {
    const code = roomCode.trim().toUpperCase();
    const name = playerName.trim();
    if (!code) { setError('Enter a room code.'); return; }
    if (!name) { setError('Enter your name.'); return; }
    if (name.length > 20) { setError('Name too long (max 20 characters).'); return; }

    setLoading(true);
    setError('');
    try {
      const err = await joinRoom(code, playerId, name);
      if (err) { setError(err); setLoading(false); return; }
    } catch (e) {
      setError('Connection error. Check your network and try again.');
      setLoading(false);
      return;
    }
    setLoading(false);

    const roundId = await getRoundId(code);
    savePlayerSession(playerId, code, name, roundId);
    setRoomCode(code);
    setPhase('game');
  }

  function handleDigitEntry(e) {
    const targetBox = Number(e.target.dataset.qidx);
    if (Number.isNaN(targetBox)) return;
    if (submittedQs[targetBox]) return; // already submitted
    const raw = e.target.value.replace(/\D/g, '');
    const digit = raw.slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[targetBox] = digit;
      return next;
    });
  }

  async function handleSubmitAnswer() {
    if (activeBox === null || isActiveSubmitted) return;
    const digit = digits[activeBox];
    if (!digit) { setError('Enter a digit before submitting.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const err = await submitAnswer(roomCode, playerId, activeBox, digit);
      if (err) { setError(err); setSubmitting(false); return; }
      setSubmittedQs((prev) => {
        const next = [...prev];
        next[activeBox] = true;
        return next;
      });
    } catch (e) {
      setError('Submit failed. Try again.');
    }
    setSubmitting(false);
  }

  // ── RENDER ────────────────────────────────────────────────────────────

  // Phase: loading
  if (phase === 'loading') {
    return (
      <div className="screen player-screen">
        <div className="player-card player-card-center">
          <div className="status-icon">⏳</div>
          <h2 className="player-status-title">Connecting…</h2>
          <p className="muted">Checking your session</p>
        </div>
      </div>
    );
  }

  // Phase: join form
  if (phase === 'join') {
    return (
      <div className="screen player-screen">
        <div className="player-card">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h2 className="player-title">Join Game</h2>

          <div className="form-group">
            <label>Room Code</label>
            <input
              className="input input-large"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. QUIZ1"
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect="off"
            />
          </div>

          <div className="form-group">
            <label>Your Name</label>
            <input
              className="input input-large"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Alice"
              maxLength={20}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button
            className="btn btn-primary btn-large"
            onClick={handleJoin}
            disabled={loading}
          >
            {loading ? 'Joining…' : 'Join Room →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: game (driven by room.stage from Firebase) ──────────────────

  const stage = room?.stage;
  const players = room?.players ?? {};
  const playerList = Object.values(players);

  // ── Shared digit boxes component ──────────────────────────────────────
  function renderDigitBoxes(activeIdx) {
    return (
      <div className="prog-digits">
        {digits.map((d, i) => {
          let cls = 'prog-box';
          if (activeIdx !== null && i === activeIdx) {
            cls += submittedQs[i] ? ' prog-box-done' : ' prog-box-active';
          } else if (activeIdx !== null && i < activeIdx) {
            cls += ' prog-box-done';
          } else if (activeIdx !== null && i > activeIdx) {
            cls += ' prog-box-future';
          } else {
            cls += ' prog-box-done'; // result — all locked
          }
          if (d) cls += ' prog-box-filled';
          return (
            <div key={i} className={cls}>
              <span className="prog-box-label">Q{i + 1}</span>
              <span className="prog-box-value">
                {d || (activeIdx !== null && i === activeIdx && !submittedQs[i] ? '_' : '–')}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Waiting / lobby
  if (!stage || stage === 'waiting') {
    return (
      <div className="screen player-screen">
        <div className="player-card player-card-center">
          <div className="status-icon">⏳</div>
          <h2 className="player-status-title">You're in!</h2>
          <p className="player-name-display">{playerName}</p>
          <p className="muted">Waiting for the host to start…</p>
          <div className="player-list-small">
            {playerList.map((p, i) => (
              <span
                key={i}
                className={`player-chip ${p.name === playerName ? 'player-chip-you' : ''}`}
              >
                {p.name}
                {p.name === playerName ? ' (you)' : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Question phase — per-question submit
  if (stage === 'question') {
    const qIdx = room?.questionIndex ?? 0;
    const answered = submittedQs[qIdx];

    return (
      <div className="screen player-screen">
        <div className="player-card player-card-center">
          <p className="question-progress">Question {qIdx + 1} of {CODE_LENGTH}</p>
          <div className={`player-countdown ${countdown <= 3 ? 'countdown-urgent' : ''}`}>
            {countdown}s
          </div>

          {renderDigitBoxes(qIdx)}

          {answered ? (
            <>
              <div className="status-icon">✅</div>
              <h2 className="player-status-title">Answer submitted!</h2>
              <p className="muted">Waiting for the next question…</p>
            </>
          ) : (
            <>
              <div className="watch-icon">👀</div>
              <h2 className="watch-title">Watch the screen!</h2>
              <p className="watch-hint">Enter your answer for Question {qIdx + 1} below</p>

              <input
                key={qIdx}
                ref={inputRef}
                className="prog-hidden-input"
                type="tel"
                inputMode="numeric"
                data-qidx={qIdx}
                value={digits[qIdx] || ''}
                onChange={handleDigitEntry}
                autoFocus
                aria-label={`Enter answer for question ${qIdx + 1}`}
              />

              <button
                className="btn btn-primary"
                onClick={handleSubmitAnswer}
                disabled={!digits[qIdx] || submitting}
                style={{ marginTop: 8, minWidth: 160 }}
              >
                {submitting ? 'Submitting…' : 'Submit Answer'}
              </button>

              <p className="input-hint">Tap the box and enter a digit (0–9)</p>
            </>
          )}

          {error && <p className="error-msg">{error}</p>}
        </div>
      </div>
    );
  }

  // Result — show all players leaderboard
  if (stage === 'result') {
    const result = room?.result;
    const correctCode = result?.correctCode;
    const isWinner = result?.chosenPlayerId === playerId;
    const ranked = rankSubmissions(result?.submissions, result?.chosenPlayerId);

    return (
      <div className="screen player-screen">
        <div className="player-card player-card-center" style={{ maxWidth: 560 }}>
          {isWinner ? (
            <>
              <div className="result-trophy">🏆</div>
              <h2 className="result-win-title">You Won!</h2>
              <p className="muted">Congratulations, {playerName}!</p>
            </>
          ) : (
            <>
              <div className="status-icon">🎮</div>
              <h2 className="player-status-title">Game Over</h2>
            </>
          )}

          {correctCode && (
            <div className="result-compare">
              <div className="result-compare-row">
                <span className="result-compare-label">Correct answer</span>
                <div className="result-compare-digits">
                  {correctCode.split('').map((d, i) => (
                    <span key={i} className="result-cdigit result-cdigit-correct">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ width: '100%' }}>
            <p className="submissions-title">LEADERBOARD</p>
            {ranked.map((s, rank) => {
              const isMe = s.id === playerId;
              const isRowWinner = s.id === result?.chosenPlayerId;
              const codeDisplay = s.code.replace(/-/g, '–');
              return (
                <div
                  key={s.id}
                  className={`submission-row ${isRowWinner ? 'submission-winner' : ''}`}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 4,
                    padding: '10px 14px',
                    border: isMe ? '1px solid var(--gold)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>
                      {rank + 1}. {s.name}
                      {isMe ? ' (you)' : ''}
                      {isRowWinner ? ' 🏆' : ''}
                    </span>
                    <span className="submission-code">{codeDisplay}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.8rem' }}>
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

          <p className="muted">{result?.message ?? 'Thanks for playing!'}</p>
        </div>
      </div>
    );
  }

  // Catch-all fallback
  return (
    <div className="screen player-screen">
      <div className="player-card player-card-center">
        <div className="status-icon">⏳</div>
        <h2 className="player-status-title">Hang tight…</h2>
        <p className="muted">Waiting for the host</p>
      </div>
    </div>
  );
}
