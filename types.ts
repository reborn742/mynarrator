export interface QuestionTOCItem {
  question: string;
  pageIndex: number;
}

export interface ClaimVerification {
  id: string;
  claim: string;
  hasSource: boolean;
  isSupported: boolean;
  explanation: string;
}

export interface InvalidatedHighlight {
  originalText: string;
  note?: string;
  reason: string;
}
export enum FileType {
  PDF = 'application/pdf',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT = 'text/plain',
  UNKNOWN = 'unknown'
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  description: string;
  lang?: string;
  isNative?: boolean;
  pitch?: number;
  rate?: number;
}

export interface ProcessingState {
  isParsing: boolean;
  isGeneratingAudio: boolean;
  error: string | null;
}

export interface Highlight {
  id: string;
  pageIndex: number;
  text: string;
  color: string;
  type?: string;
  note?: string;
  startOffset?: number;
  endOffset?: number;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  pageIndex: number;
  title: string;
  createdAt: number;
}

export interface TOCItem {
  title: string;
  pageIndex: number;
  level: number;
}

export interface GoalHighlightResult {
  pageIndex: number;
  text: string;
  reason: string;
  color?: string;
  type?: string;
  startOffset?: number;
  endOffset?: number;
}
export interface MergedConnection {
  type: 'agree' | 'contradict' | 'redundant';
  pageIndex: number; // page in the merged document
  text: string;
  explanation: string;
}

export interface DocumentVersionComparison {
  summary: string;
  importantChanges: string[];
  minorChanges: string[];
  invalidatedHighlights?: InvalidatedHighlight[];
}
