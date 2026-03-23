// src/lib/serverClock.js
// Syncs with Firebase's server clock so all devices use the same time reference.

import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';

let _offset = 0;

// Wrapped in try-catch so a Firebase init failure doesn't crash every module
// that imports serverNow.
try {
  onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
    _offset = snap.val() ?? 0;
  });
} catch (e) {
  console.warn('serverClock: could not subscribe to server time offset', e);
}

export function serverNow() {
  return Date.now() + _offset;
}
