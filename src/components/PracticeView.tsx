import React from 'react';
import VoiceCallController from './VoiceCallController';

export default function PracticeView() {
  return (
    <div id="practice-viewport" className="flex flex-col h-full bg-[#0a0a0a] text-[#e0e0e0]">
      <VoiceCallController
        mode="practice"
        title="English Fluency Practice"
        description="Speak English naturally. Gemini acts as your motivational partner, reviewing your pronunciation, word choice, and tenses, and gently correcting any grammatical mistakes via voice."
        themeColor="emerald"
        emoji="🎓"
      />
    </div>
  );
}
