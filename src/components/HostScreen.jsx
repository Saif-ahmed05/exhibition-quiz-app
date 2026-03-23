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
  openCodeEntry,
  saveResult,
  updateStage,
  verifyHostToken,
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function HostScreen({ onBack }) {
  // Load any existing session once on mount
  const storedSession = useMemo(loadHostSession, []);

  // step: 'loading' (auto-reconnect check) | 'setup' | 'game'
  // If we have a stored session, start in 'loading' to auto-reconnect without
  // requiring a manual click — this keeps auto-advance timers running across refreshes.
  const [step, setStep] = useState(() => storedSession ? 'loading' : 'setup');

  // Form state — pre-filled from session if available
  const [roomCode, setRoomCode] = useState(() => storedSession?.roomCode ?? generateRoomCode());
  const [selectedCategory, setSelectedCategory] = useState(() => storedSession?.category ?? CATEGORIES[0].id);

  // hostToken is stable for this browser session. On first visit a new UUID is
  // generated; on refresh the same one is reloaded from sessionStorage.
  const [hostToken] = useState(() => storedSession?.hostToken ?? crypto.randomUUID());

  // Game state driven entirely by Firebase
  const [room, setRoom] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Stable ref to room so timer callbacks always see latest value
  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);

  // ── Auto-reconnect on mount (no manual click needed) ──────────────────────
  useEffect(() => {
    if (step !== 'loading' || !storedSession) return;

    verifyHostToken(storedSession.roomCode, storedSession.hostToken)
      .then((valid) => {
        if (valid) {
          setStep('game');
        } else {
          clearHostSession();
          setStep('setup');
        }
      })
      .catch(() => {
        // Firebase unreachable — fall back to setup
        clearHostSession();
        setStep('setup');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to Firebase room once game step is active
  useEffect(() => {
    if (step !== 'game') return;
    return listenToRoom(roomCode, setRoom);
  }, [step, roomCode]);

  // ── Question countdown & auto-advance ──────────────────────────────────────
  useEffect(() => {
    if (room?.stage !== 'question' || !room?.questionEndsAt) return;

    const qIdx = room.questionIndex;
    let advanced = false;

    const advance = async () => {
      if (advanced) return;
      advanced = true;
      try {
        if (qIdx >= 3) await openCodeEntry(roomCode, hostToken);
        else await startQuestion(roomCode, qIdx + 1, hostToken);
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
  }, [room?.stage, room?.questionIndex, room?.questionEndsAt, roomCode, hostToken]);

  // ── Code-entry countdown & auto-show-result ────────────────────────────────
  useEffect(() => {
    if (room?.stage !== 'code_entry' || !room?.codeEntryEndsAt) return;

    let advanced = false;

    const advance = async () => {
      if (advanced) return;
      advanced = true;
      try { await computeAndSaveResult(); }
      catch (e) { console.error('Auto-result error:', e); }
    };

    const tick = () => {
      const rem = Math.ceil((room.codeEntryEndsAt - serverNow()) / 1000);
      setCountdown(Math.max(0, rem));
      if (rem <= 0) advance();
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.stage, room?.codeEntryEndsAt]);

  // ── Result computation ────────────────────────────────────────────────────

  async function computeAndSaveResult() {
    const r = roomRef.current;
    const set = getQuizSetById(r?.setId);
    if (!set) return;

    const correctCode = set.questions.map((q) => String(q.answer)).join('');
    const result = calculateResult(r?.players || {}, correctCode);

    // Convert finalists array to a map for Firebase storage
    const finalistsMap = result.finalists.reduce((acc, f) => ({ ...acc, [f.id]: true }), {});

    await saveResult(roomCode, {
      correctCode,
      chosenPlayerId: result.winner?.id ?? null,
      finalists: finalistsMap,
      message: result.winner ? `${result.winner.name} wins!` : 'Nobody got the correct code!',
      type: result.type,
    }, hostToken);
    // saveResult already sets stage to 'result' internally
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleCreate() {
    const code = roomCode.trim().toUpperCase();
    if (code.length < 2) { setError('Room code must be at least 2 characters.'); return; }
    if (!selectedCategory) { setError('Please select an audience type.'); return; }

    // Pick the next non-repeating set for this category
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
        if (idx >= 3) await openCodeEntry(roomCode, hostToken);
        else await startQuestion(roomCode, idx + 1, hostToken);
      } else if (room?.stage === 'code_entry') {
        await computeAndSaveResult();
      }
    } catch (e) { setError(e.message); }
  }

  async function handleReset() {
    if (!window.confirm('Restart the game? All players will be removed and must rejoin.')) return;
    try {
      await resetRoom(roomCode, hostToken);
    } catch (e) { setError(e.message); return; }

    // Clear host session and return to the initial setup screen.
    // The resetRoom call already incremented roundId and cleared players,
    // so all connected player clients will be kicked back to the join form.
    clearHostSession();
    setRoom(null);
    setRoomCode(generateRoomCode());
    setSelectedCategory(CATEGORIES[0].id);
    setError('');
    setStep('setup');
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const quizSet = room?.setId ? getQuizSetById(room.setId) : null;
  const currentQuestion = quizSet?.questions[room?.questionIndex ?? 0] ?? null;
  // Build players as array with id attached
  const players = room?.players
    ? Object.entries(room.players).map(([id, p]) => ({ id, ...p }))
    : [];
  const submissions = players.filter((p) => p.submittedCode !== null);

  // ── RENDER: Loading (auto-reconnect in progress) ─────────────────────────

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

  // ── RENDER: Setup ─────────────────────────────────────────────────────────

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

  // ── RENDER: Game ──────────────────────────────────────────────────────────

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

      {/* ── Code Entry ── */}
      {stage === 'code_entry' && (
        <div className="stage-code-entry">
          <div className={`countdown countdown-big ${countdown <= 5 ? 'countdown-urgent' : ''}`}>
            {countdown}s
          </div>
          <h2 className="code-entry-title">COLLECTING ANSWERS</h2>
          <p className="code-entry-hint">Player answers are being submitted automatically</p>

          <div className="submission-status">
            <span className="submission-count">{submissions.length}</span>
            <span className="submission-label"> / {players.length} submitted</span>
          </div>

          <div className="submission-names">
            {submissions.map((p) => (
              <span key={p.id} className="submitted-badge">{p.name} ✓</span>
            ))}
          </div>

          <div className="host-actions">
            <button className="btn btn-primary" onClick={handleSkip}>
              Show Result Now
            </button>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {stage === 'result' && room?.result && (
        <div className="stage-result">
          <p className="result-label">CORRECT CODE</p>
          <div className="correct-code-display">
            {room.result.correctCode.split('').map((d, i) => (
              <span key={i} className="code-digit">{d}</span>
            ))}
          </div>

          {room.result.chosenPlayerId ? (
            <>
              <div className="winner-banner">
                🏆 {getPlayerName(room.players, room.result.chosenPlayerId)}
              </div>
              <p className="result-type-label">
                {room.result.type === 'exact' && 'Exact match!'}
                {room.result.type === 'exact_random' && 'Multiple exact matches — winner picked randomly'}
                {room.result.type === 'partial' && 'Closest answer wins'}
              </p>
            </>
          ) : (
            <div className="no-winner">No winner this round</div>
          )}

          {Object.keys(room.result.finalists ?? {}).length > 1 && (
            <div className="finalist-pool">
              <p className="finalist-title">Finalists</p>
              <div className="finalist-list">
                {Object.keys(room.result.finalists).map((id) => (
                  <span key={id} className="finalist-badge">
                    {getPlayerName(room.players, id)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="all-submissions">
            <p className="submissions-title">All submissions</p>
            {players.map((p) => {
              const code = p.submittedCode ?? '';
              const correctCode = room.result.correctCode;
              let score = 0;
              if (code && correctCode) {
                for (let i = 0; i < CODE_LENGTH; i++) {
                  if (code[i] === correctCode[i]) score++;
                }
              }
              return (
                <div
                  key={p.id}
                  className={`submission-row ${p.id === room.result.chosenPlayerId ? 'submission-winner' : ''}`}
                >
                  <span>{p.name}</span>
                  <span className="submission-score">{code ? `${score}/${CODE_LENGTH}` : '—'}</span>
                  <span className="submission-code">{code || '—'}</span>
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
      )}
    </div>
  );
}
