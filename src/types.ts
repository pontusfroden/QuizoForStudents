export interface SourceBlock {
  label: string;
  text: string;
  method?: 'text' | 'ocr';
  confidence?: number;
}
export interface StudySource {
  id: string;
  name: string;
  kind: 'notes' | 'exam';
  format: string;
  blocks: SourceBlock[];
  wordCount: number;
  warnings: string[];
  coverage?: {
    totalPages: number;
    textPages: number;
    ocrPages: number;
    unreadPages: number[];
    blankPages: number[];
  };
}
export interface StudyCard {
  id: string;
  term: string;
  prompt: string;
  answer: string;
  evidence: string;
  sourceId: string;
  location: string;
}
export interface ExamPrompt {
  id: string;
  prompt: string;
  sourceId: string;
  location: string;
  relatedCardIds: string[];
}
export interface CardProgress {
  attempts: number;
  correct: number;
  streak: number;
  lastReviewed: number;
  due: number;
}
export interface StudySession {
  time: number;
  mode: string;
  correct: number;
  total: number;
}
export interface StudyDeck {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  isDemo?: boolean;
  sources: StudySource[];
  cards: StudyCard[];
  examPrompts: ExamPrompt[];
  progress: Record<string, CardProgress>;
  sessions: StudySession[];
}
export interface Library {
  version: 1;
  decks: StudyDeck[];
  activeId: string;
}
export type View = 'overview' | 'materials' | 'study' | 'progress';
export type Mode = 'quiz' | 'flashcards' | 'match' | 'recall' | 'exam';
