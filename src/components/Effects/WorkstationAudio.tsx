'use client'

import React, { createContext, useContext, useEffect, useRef } from 'react'

/**
 * Workstation Audio UX Context.
 * Provides subtle audio feedback (clicks, hums) for the workstation interface.
 */
interface AudioContextType {
  playClick: () => void;
  playDataHum: (active: boolean) => void;
  playSuccess: () => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
};

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const clickRef = useRef<HTMLAudioElement | null>(null);
  const successRef = useRef<HTMLAudioElement | null>(null);
  const humRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // We use basic oscillators or base64 samples to avoid external assets for this demo
    // Alternatively, I could use the Web Audio API to synthesize these sounds locally.
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const createOscillator = (freq: number, type: OscillatorType, duration: number, gainValue = 0.1) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainValue, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    };

    const playClick = () => {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      createOscillator(800, 'square', 0.05, 0.02);
    };

    const playSuccess = () => {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      createOscillator(440, 'sine', 0.2, 0.05);
      setTimeout(() => createOscillator(880, 'sine', 0.2, 0.05), 100);
    };

    const playDataHum = (active: boolean) => {
      if (active) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const hum = audioCtx.createOscillator();
        const humGain = audioCtx.createGain();
        hum.type = 'sine';
        hum.frequency.setValueAtTime(60, audioCtx.currentTime); // Low frequency 60Hz hum
        humGain.gain.setValueAtTime(0.01, audioCtx.currentTime);
        hum.connect(humGain);
        humGain.connect(audioCtx.destination);
        hum.start();
        (window as any)._workstationHum = hum;
        (window as any)._workstationHumGain = humGain;
      } else {
        if ((window as any)._workstationHum) {
          (window as any)._workstationHumGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
          setTimeout(() => {
            (window as any)._workstationHum.stop();
            (window as any)._workstationHum = null;
          }, 500);
        }
      }
    };

    (window as any)._playClick = playClick;
    (window as any)._playSuccess = playSuccess;
    (window as any)._playDataHum = playDataHum;

    return () => {
      audioCtx.close();
    };
  }, []);

  const value = {
    playClick: () => (window as any)._playClick?.(),
    playSuccess: () => (window as any)._playSuccess?.(),
    playDataHum: (active: boolean) => (window as any)._playDataHum?.(active),
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}
