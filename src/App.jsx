// src/App.jsx
// Top-level mode router. Keeps routing logic separate from screen components.

import { useState } from 'react';
import HomeScreen from './components/HomeScreen';
import HostScreen from './components/HostScreen';
import PlayerScreen from './components/PlayerScreen';

export default function App() {
  // mode: 'home' | 'host' | 'player'
  const [mode, setMode] = useState('home');

  if (mode === 'host') return <HostScreen onBack={() => setMode('home')} />;
  if (mode === 'player') return <PlayerScreen onBack={() => setMode('home')} />;
  return <HomeScreen onHost={() => setMode('host')} onPlayer={() => setMode('player')} />;
}
