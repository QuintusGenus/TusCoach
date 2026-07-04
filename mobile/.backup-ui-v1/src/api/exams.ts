import { client } from './client';

export interface MockExamBreakdown {
  id: number;
  subject: string | null;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
}

export interface MockExam {
  id: number;
  exam_name: string | null;
  date: string;
  total_score: number | null;
  notes: string | null;
  created_at: string;
  breakdowns: MockExamBreakdown[];
}

export interface BreakdownInput {
  subject: string;
  correct: number;
  wrong: number;
  blank: number;
}

export interface CreateMockExamData {
  exam_name: string;
  date: string;
  notes?: string;
  breakdowns: BreakdownInput[];
}

export const fetchExams = async (limit: number = 20): Promise<MockExam[]> => {
  const res = await client.get('/students/me/exams', { params: { limit } });
  return res.data;
};

export const fetchExamById = async (id: number): Promise<MockExam> => {
  const res = await client.get(`/students/me/exams/${id}`);
  return res.data;
};

export const createExam = async (data: CreateMockExamData): Promise<MockExam> => {
  const res = await client.post('/students/me/exams', data);
  return res.data;
};

export const deleteExam = async (id: number): Promise<void> => {
  await client.delete(`/students/me/exams/${id}`);
};
