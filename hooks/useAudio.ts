import { useCallback, useState } from 'react';

export const useAudio = () => {
  const [isMuted, setIsMuted] = useState(false);

  const speak = useCallback((text: string) => {
    if (isMuted) return; // Silent if muted
    if (!window.speechSynthesis) return;
    
    // Cancel previous utterances to avoid queue buildup
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; 
    utterance.pitch = 1.0;
    utterance.volume = 0.5; 
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  const toggleMute = useCallback(() => {
      setIsMuted(prev => !prev);
  }, []);

  return { speak, isMuted, toggleMute };
};
