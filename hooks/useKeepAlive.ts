
import { useEffect, useRef, useState } from 'react';

/**
 * THE INSOMNIA ENGINE
 * 
 * 1. Wake Lock API: Prevents screen from dimming/sleeping.
 * 2. Ghost Audio: Plays a silent oscillator to force browser high-priority mode.
 * 3. Web Worker: Runs the timer in a separate thread to avoid tab throttling.
 */
export const useKeepAlive = (isRunning: boolean, onTick: () => void) => {
  const [isActive, setIsActive] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // 1. Worker Setup (The Heartbeat)
  // We use a Blob instead of a separate file to avoid "Invalid URL" errors with import.meta.url
  useEffect(() => {
    const workerScript = `
      self.onmessage = (e) => {
          if (e.data === 'START') {
              if (!self.timerId) {
                  self.timerId = setInterval(() => {
                      self.postMessage('TICK');
                  }, 1000);
              }
          } else if (e.data === 'STOP') {
              if (self.timerId) {
                  clearInterval(self.timerId);
                  self.timerId = null;
              }
          }
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    try {
        workerRef.current = new Worker(workerUrl);
        workerRef.current.onmessage = (e) => {
            if (e.data === 'TICK') {
                onTick();
            }
        };
    } catch (e) {
        console.error("Insomnia Engine Worker Failed:", e);
    }

    return () => {
        workerRef.current?.terminate();
        URL.revokeObjectURL(workerUrl);
    };
  }, [onTick]);

  // 2. Control Logic
  useEffect(() => {
    const manageInsomnia = async () => {
        if (isRunning) {
            // A. Start Worker
            workerRef.current?.postMessage('START');

            // B. Acquire Wake Lock
            try {
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await navigator.wakeLock.request('screen');
                }
            } catch (err) {
                console.warn("Wake Lock not supported/allowed:", err);
            }

            // C. Start Ghost Audio (Needs user interaction first)
            try {
                if (!audioCtxRef.current) {
                    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                    audioCtxRef.current = new AudioContext();
                }

                if (audioCtxRef.current.state === 'suspended') {
                    await audioCtxRef.current.resume();
                }

                if (!oscillatorRef.current) {
                    const osc = audioCtxRef.current.createOscillator();
                    const gain = audioCtxRef.current.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1, audioCtxRef.current.currentTime);
                    gain.gain.setValueAtTime(0.0001, audioCtxRef.current.currentTime); // Inaudible
                    
                    osc.connect(gain);
                    gain.connect(audioCtxRef.current.destination);
                    osc.start();
                    oscillatorRef.current = osc;
                }
            } catch (e) {
                console.warn("Audio Engine blocked:", e);
            }
            
            setIsActive(true);
        } else {
            // Stop Worker
            workerRef.current?.postMessage('STOP');

            // Release Wake Lock
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            }

            // Stop Audio
            if (oscillatorRef.current) {
                oscillatorRef.current.stop();
                oscillatorRef.current.disconnect();
                oscillatorRef.current = null;
            }
            
            setIsActive(false);
        }
    };

    manageInsomnia();

  }, [isRunning]);

  return { isEngineActive: isActive };
};
