/**
 * Speaks the text aloud using the web browser's native text-to-speech engine.
 * Supports finding standard natural English voices.
 */
export function speakText(text: string, voiceName?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' | string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not supported in this environment.');
    return;
  }

  // Stop any ongoing speech
  window.speechSynthesis.cancel();

  // Create an utterance. Strip asterisks from emphasis strings
  const cleanedText = text.replace(/\*/g, '');
  const utterance = new SpeechSynthesisUtterance(cleanedText);

  // Attempt to select a natural-sounding English voice
  const voices = window.speechSynthesis.getVoices();
  let selectedVoice = voices.find(v => 
    v.lang.startsWith('en') && 
    (v.name.includes('Google') || v.name.includes('Natural') || v.name.toLowerCase().includes('female'))
  );

  if (!selectedVoice) {
    selectedVoice = voices.find(v => v.lang.startsWith('en'));
  }

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  // Adjust options for clear explanation
  utterance.rate = 0.95; // Slightly slower for language learners
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
}

/**
 * Returns a new speech recognition object if supported
 */
export function createSpeechRecognition(): any {
  if (typeof window === 'undefined') return null;

  const SpeechRecognition = 
    (window as any).SpeechRecognition || 
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  return recognition;
}

/**
 * Formats seconds into MM:SS notation
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats hours, minutes, and seconds for the session clock
 */
export function formatSessionClock(date: Date): string {
  const hrs = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  const secs = date.getSeconds().toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}
