import React from 'react';
import VoiceCallController from './VoiceCallController';

export default function DebateView() {
  return (
    <div id="debate-viewport" className="flex flex-col h-full bg-transparent text-zinc-800">
      <VoiceCallController
        mode="debate"
        title="Interactive Academic Debate"
        description="Engage in a quick-fire debate with Gemini. Start by proposing any debate topic you like, or ask Gemini to suggest a starting thesis to engage on!"
        themeColor="violet"
        emoji="⚖️"
      />
    </div>
  );
}
