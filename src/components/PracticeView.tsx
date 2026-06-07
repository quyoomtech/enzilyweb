import React from 'react';
import VoiceCallController from './VoiceCallController';

export default function PracticeView() {
  return (
    <div id="practice-viewport" className="flex flex-col h-full bg-transparent text-zinc-800">
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
