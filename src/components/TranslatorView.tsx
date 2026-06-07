import React from 'react';
import VoiceCallController from './VoiceCallController';

export default function TranslatorView() {
  return (
    <div id="translator-viewport" className="flex flex-col h-full bg-[#0a0a0a] text-[#e0e0e0]">
      <VoiceCallController
        mode="translator"
        title="Real-Time Voice Translator"
        description="Speak in any language. Gemini automatically detects your speech, and instantly translates it back to you. English is translated to Spanish, and non-English is translated to fluent English!"
        themeColor="indigo"
        emoji="🗣️"
      />
    </div>
  );
}
