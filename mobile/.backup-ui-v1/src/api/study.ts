import { client } from './client';

export interface StudySession {
  id: number;
  student_id: number;
  date: string;
  minutes: number;
  subject: string | null;
  topic_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface CreateStudySessionData {
  date: string;
  minutes: number;
  subject?: string;
  topic_id?: number;
  notes?: string;
}

export const fetchStudySessions = async (
  days: number = 30,
  subject?: string,
): Promise<StudySession[]> => {
  const params: Record<string, unknown> = { days };
  if (subject) params.subject = subject;
  const res = await client.get('/sessions/students/me/sessions', { params });
  return res.data;
};

export const createStudySession = async (
  data: CreateStudySessionData,
): Promise<StudySession> => {
  const res = await client.post('/sessions/', data);
  return res.data;
};

export const deleteStudySession = async (id: number): Promise<void> => {
  await client.delete(`/sessions/students/me/sessions/${id}`);
};
