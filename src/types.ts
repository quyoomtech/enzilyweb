export type ActiveTab = 'translator' | 'practice' | 'debate';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  originalText?: string;
  detectedLang?: string;
  emphasizedText?: string; // e.g. "What *are* you doing"
  isCorrect?: boolean;
  correctedText?: string;
  explanation?: string;
  timestamp: string;
}

export interface TranslationResponse {
  detectedLanguage: string;
  translation: string;
  emphasized: string;
}

export interface CorrectionResponse {
  isCorrect: boolean;
  corrected: string;
  explanation: string;
  reply: string;
}

export interface DebateResponse {
  reply: string;
}

export interface DebateTopic {
  id: string;
  title: string;
  emoji: string;
  description: string;
  firstArgument?: string;
}
