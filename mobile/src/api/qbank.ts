import { client } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Question {
  id: string;
  test: string;
  subject: string;
  subtopic: string | null;
  stem: string;
  options: Record<string, string>;   // {"A": "...", "B": "...", ...}
  status: string;
}

export interface TodayQueueResponse {
  questions: Question[];
  srs_due_count: number;
}

export interface AttemptResult {
  is_correct: boolean;
  correct_key: string;
  explanation: string | null;
}

export interface MasteryItem {
  subject: string;
  test: string;
  attempts: number;
  correct: number;
  rate: number;    // 0.0 – 1.0
}

export interface QBankExamSession {
  id: number;
  test_type: string;
  question_ids: string[];
  answers: Record<string, string> | null;
  started_at: string;
  submitted_at: string | null;
  score_pct: number | null;
  by_subject: Record<string, { correct: number; total: number }> | null;
}

export interface QBankExamResult {
  id: number;
  score_pct: number;
  correct: number;
  total: number;
  by_subject: Record<string, { correct: number; total: number }>;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const getTodayQuestions = async (): Promise<TodayQueueResponse> => {
  const res = await client.get('/students/me/qbank/today');
  return res.data;
};

export const getQuestion = async (id: string): Promise<Question> => {
  const res = await client.get(`/students/me/qbank/questions/${id}`);
  return res.data;
};

export const recordAttempt = async (
  question_id: string,
  selected_key: string,
): Promise<AttemptResult> => {
  const res = await client.post('/students/me/qbank/attempts', {
    question_id,
    selected_key,
  });
  return res.data;
};

export const getMastery = async (): Promise<MasteryItem[]> => {
  const res = await client.get('/students/me/qbank/mastery');
  return res.data;
};

export const startQBankExam = async (test_type: 'temel' | 'klinik'): Promise<QBankExamSession> => {
  const res = await client.post('/students/me/qbank/exams', { test_type });
  return res.data;
};

export const submitQBankExam = async (
  session_id: number,
  answers: Record<string, string>,
): Promise<QBankExamResult> => {
  const res = await client.post(`/students/me/qbank/exams/${session_id}/submit`, { answers });
  return res.data;
};

export const getQBankExam = async (session_id: number): Promise<QBankExamSession> => {
  const res = await client.get(`/students/me/qbank/exams/${session_id}`);
  return res.data;
};

// ─── Drill Mode ───────────────────────────────────────────────────────────────

export interface SubjectItem {
  subject: string;
  subtopics: string[];
}

export interface DrillQueueResponse {
  questions: Question[];
  subject: string;
  subtopic: string | null;
}

export const getSubjects = async (): Promise<SubjectItem[]> => {
  const res = await client.get('/students/me/qbank/subjects');
  return res.data;
};

export const getDrillQuestions = async (
  subject: string,
  subtopic?: string,
  limit = 10,
): Promise<DrillQueueResponse> => {
  const params: Record<string, string | number> = { subject, limit };
  if (subtopic) params.subtopic = subtopic;
  const res = await client.get('/students/me/qbank/drill', { params });
  return res.data;
};

// ─── Subtopic Mastery ─────────────────────────────────────────────────────────

export interface SubtopicMasteryItem {
  subtopic: string;
  attempts: number;
  correct: number;
  rate: number;
}

export const getSubtopicMastery = async (subject: string): Promise<SubtopicMasteryItem[]> => {
  const res = await client.get(`/students/me/qbank/mastery/${encodeURIComponent(subject)}`);
  return res.data;
};
