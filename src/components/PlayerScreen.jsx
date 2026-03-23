// src/components/PlayerScreen.jsx

import { useState, useEffect, useRef } from 'react';
import { listenToRoom, joinRoom, submitCode, checkPlayerExists, getRoundId } from '../lib/realtimeDb';
import { serverNow } from '../lib/serverClock';
import { CODE_LENGTH } from '../lib/constants';

// ─── Safe UUID (crypto.randomUUID crashes on insecure contexts like http LAN) ─

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlayerScreen({ onBack }) {
  const [storedSession] = useState(loadPlayerSession);

  const [phase, setPhase] = useState('loading');
  const [playerId] = useState(() => storedSession?.playerId ?? safeId());
  const [roomCode, setRoomCode] = useState(() => storedSession?.roomCode ?? '');
  const [playerName, setPlayerName] = useState(() => storedSession?.playerName ?? '');

  const [room, setRoom] = useState(null);
  const [digits, setDigits] = useState(() => Array(CODE_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  // ── Firebase subscription (active while in game phase) ──────────────────
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
      setSubmitted(false);
      setDigits(Array(CODE_LENGTH).fill(''));
      setError('');
      setPhase('join');
    }
  }, [phase, room, playerId]);

  // ── Countdown ticker ────────────────────────────────────────────────────
  useEffect(() => {
    const endsAt =
      room?.stage === 'question' ? room.questionEndsAt :
      room?.stage === 'code_entry' ? room.codeEntryEndsAt :
      null;

    if (!endsAt) { setCountdown(0); return; }

    const tick = () =>
      setCountdown(Math.max(0, Math.ceil((endsAt - serverNow()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [room?.stage, room?.questionEndsAt, room?.codeEntryEndsAt]);

  // ── Recover submitted state from Firebase (survives player refresh) ─────
  useEffect(() => {
    if (!room || submitted) return;
    const myPlayer = room.players?.[playerId];
    if (myPlayer?.submittedCode) {
      setDigits(myPlayer.submittedCode.split(''));
      setSubmitted(true);
    }
  }, [room, playerId, submitted]);

  // ── Derive which box is currently active ────────────────────────────────
  const activeBox = (room?.stage === 'question') ? (room?.questionIndex ?? 0) : null;

  // ── Auto-focus input when active box changes ────────────────────────────
  useEffect(() => {
    if (activeBox !== null && !submitted) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [activeBox, submitted]);

  // ── Auto-submit when entering code_entry stage ──────────────────────────
  useEffect(() => {
    if (room?.stage !== 'code_entry' || submitted) return;
    const code = digits.map((d) => d || '0').join('');
    (async () => {
      try {
        const err = await submitCode(roomCode, playerId, code);
        if (err) console.error('Auto-submit error:', err);
      } catch (e) {
        console.error('Auto-submit failed:', e);
      }
      setSubmitted(true);
    })();
  }, [room?.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────────────────────

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
    if (activeBox === null) return;
    const raw = e.target.value.replace(/\D/g, '');
    const digit = raw.slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[activeBox] = digit;
      return next;
    });
  }

  // ── RENDER ──────────────────────────────────────────────────────────────

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

  // ── Phase: game (driven by room.stage from Firebase) ────────────────────

  const stage = room?.stage;
  const players = room?.players ?? {};
  const playerList = Object.values(players);

  // ── Shared digit boxes component ────────────────────────────────────────
  function renderDigitBoxes(activeIdx) {
    return (
      <div
        className="prog-digits"
        onClick={() => activeIdx !== null && inputRef.current?.focus()}
      >
        {digits.map((d, i) => {
          let cls = 'prog-box';
          if (activeIdx !== null && i === activeIdx) cls += ' prog-box-active';
          else if (activeIdx !== null && i < activeIdx) cls += ' prog-box-done';
          else if (activeIdx !== null && i > activeIdx) cls += ' prog-box-future';
          else cls += ' prog-box-done'; // code_entry / result — all locked
          if (d) cls += ' prog-box-filled';
          return (
            <div key={i} className={cls}>
              <span className="prog-box-label">Q{i + 1}</span>
              <span className="prog-box-value">
                {d || (activeIdx !== null && i === activeIdx ? '_' : '–')}
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

  // Question phase — progressive digit entry
  if (stage === 'question') {
    const qIdx = room?.questionIndex ?? 0;
    return (
      <div className="screen player-screen">
        <div className="player-card player-card-center">
          <p className="question-progress">Question {qIdx + 1} of {CODE_LENGTH}</p>
          <div className={`player-countdown ${countdown <= 3 ? 'countdown-urgent' : ''}`}>
            {countdown}s
          </div>
          <div className="watch-icon">👀</div>
          <h2 className="watch-title">Watch the screen!</h2>
          <p className="watch-hint">Enter your answer for Question {qIdx + 1} below</p>

          {renderDigitBoxes(qIdx)}

          <input
            ref={inputRef}
            className="prog-hidden-input"
            type="tel"
            inputMode="numeric"
            value={digits[qIdx] || ''}
            onChange={handleDigitEntry}
            autoFocus
            aria-label={`Enter answer for question ${qIdx + 1}`}
          />
          <p className="input-hint">Tap the boxes and enter a digit (0–9)</p>
        </div>
      </div>
    );
  }

  // Code entry — auto-submit in progress
  if (stage === 'code_entry') {
    return (
      <div className="screen player-screen">
        <div className="player-card player-card-center">
          <div className="status-icon">{submitted ? '✅' : '⏳'}</div>
          <h2 className="player-status-title">
            {submitted ? 'Answers submitted!' : 'Submitting…'}
          </h2>
          {renderDigitBoxes(null)}
          <p className="muted">Waiting for the result…</p>
        </div>
      </div>
    );
  }

  // Result — show comparison
  if (stage === 'result') {
    const result = room?.result;
    const myPlayer = players[playerId];
    const correctCode = result?.correctCode;
    const myCode = myPlayer?.submittedCode || digits.map((d) => d || '0').join('');
    const isWinner = result?.chosenPlayerId === playerId;
    const isFinalist = result?.finalists?.[playerId];

    let matchCount = 0;
    if (correctCode && myCode) {
      for (let i = 0; i < CODE_LENGTH; i++) {
        if (myCode[i] === correctCode[i]) matchCount++;
      }
    }

    return (
      <div className="screen player-screen">
        <div className="player-card player-card-center">
          {isWinner ? (
            <>
              <div className="result-trophy">🏆</div>
              <h2 className="result-win-title">You Won!</h2>
              <p className="muted">Congratulations, {playerName}!</p>
            </>
          ) : isFinalist ? (
            <>
              <div className="status-icon">🌟</div>
              <h2 className="player-status-title">You were a finalist!</h2>
            </>
          ) : (
            <>
              <div className="status-icon">🎮</div>
              <h2 className="player-status-title">Game Over</h2>
            </>
          )}

          {correctCode && myCode && (
            <div className="result-compare">
              <div className="result-compare-row">
                <span className="result-compare-label">Your answer</span>
                <div className="result-compare-digits">
                  {myCode.split('').map((d, i) => (
                    <span
                      key={i}
                      className={`result-cdigit ${d === correctCode[i] ? 'result-cdigit-match' : 'result-cdigit-wrong'}`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
              <div className="result-compare-row">
                <span className="result-compare-label">Correct answer</span>
                <div className="result-compare-digits">
                  {correctCode.split('').map((d, i) => (
                    <span key={i} className="result-cdigit result-cdigit-correct">{d}</span>
                  ))}
                </div>
              </div>
              <p className="result-score">{matchCount} / {CODE_LENGTH} correct</p>
            </div>
          )}

          <p className="muted">{result?.message ?? 'Thanks for playing!'}</p>
          <p className="result-footer">Watch the host screen for full results.</p>
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
