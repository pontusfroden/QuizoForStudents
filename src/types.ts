export interface SourceBlock {
  label: string;
  text: string;
  method?: 'text' | 'ocr';
  confidence?: number;
  /** Local JPEG preview for diagrams, scans, and text that OCR cannot safely recover. */
  image?: string;
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
  kind?: 'cloze' | 'question' | 'image';
  choices?: string[];
  /** An empty answer means the source contains a question, but no verified solution. */
  answerStatus?: 'source' | 'missing' | 'ai';
  answerExplanation?: string;
  answerBasis?: 'material' | 'general';
  answerModel?: string;
  answerReference?: { sourceId: string; location: string; quote: string };
  matchText?: string;
}
export interface ExamPrompt {
  id: string;
  prompt: string;
  sourceId: string;
  location: string;
  relatedCardIds: string[];
  choices?: string[];
  answer?: string;
  answerStatus?: 'source' | 'missing' | 'ai';
  answerExplanation?: string;
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
  generationVersion?: number;
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
