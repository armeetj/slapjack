'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SoundType =
  | 'hover'
  | 'click'
  | 'cardPlace'
  | 'cardSlide'
  | 'shuffle'
  | 'slapHit'
  | 'slapMiss'
  | 'win'
  | 'lose'
  | 'countdown';

// Map sound types to actual files
const soundFiles: Record<SoundType, string> = {
  hover: '/sounds/old-computer-click-152513.mp3',
  click: '/sounds/old-computer-click-152513.mp3',
  cardPlace: '/sounds/card-sounds-35956.mp3',
  cardSlide: '/sounds/card-sounds-35956.mp3',
  shuffle: '/sounds/card-shuffle-94662.mp3',
  slapHit: '/sounds/card-sounds-35956.mp3',
  slapMiss: '/sounds/old-computer-click-152513.mp3',
  win: '/sounds/card-shuffle-94662.mp3',
  lose: '/sounds/old-computer-click-152513.mp3',
  countdown: '/sounds/old-computer-click-152513.mp3',
};

interface SoundManager {
  play: (sound: SoundType) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  isMuted: boolean;
  volume: number;
}

export function useSound(): SoundManager {
  const [volume, setVolumeState] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = volume;
      }

      // Preload sounds
      Object.values(soundFiles).forEach((file) => {
        if (!bufferCacheRef.current.has(file)) {
          fetch(file)
            .then((response) => response.arrayBuffer())
            .then((arrayBuffer) =>
              audioContextRef.current!.decodeAudioData(arrayBuffer)
            )
            .then((audioBuffer) => {
              bufferCacheRef.current.set(file, audioBuffer);
            })
            .catch(() => {
              // Sound file not found, silent fail
            });
        }
      });

      // Remove listener after first interaction
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };

    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, [volume]);

  const play = useCallback(
    (sound: SoundType) => {
      if (isMuted || !audioContextRef.current || !gainNodeRef.current) return;

      const file = soundFiles[sound];
      const buffer = bufferCacheRef.current.get(file);

      if (!buffer) {
        // Sound not loaded yet, try to play directly with Audio element
        const audio = new Audio(file);
        audio.volume = volume;
        audio.play().catch(() => {});
        return;
      }

      // Resume context if suspended
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      // Create and play buffer source
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNodeRef.current);
      source.start(0);
    },
    [isMuted, volume]
  );

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = clampedVolume;
    }
  }, []);

  const mute = useCallback(() => {
    setIsMuted(true);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = 0;
    }
  }, []);

  const unmute = useCallback(() => {
    setIsMuted(false);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  return {
    play,
    setVolume,
    mute,
    unmute,
    isMuted,
    volume,
  };
}
