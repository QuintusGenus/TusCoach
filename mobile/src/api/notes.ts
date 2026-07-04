import { client } from './client';

export interface Note {
  id: number;
  subject: string | null;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateNoteData {
  subject?: string;
  title: string;
  content?: string;
}

export interface UpdateNoteData {
  subject?: string;
  title?: string;
  content?: string;
}

export const fetchNotes = async (
  subject?: string,
  limit: number = 50,
): Promise<Note[]> => {
  const params: Record<string, unknown> = { limit };
  if (subject) params.subject = subject;
  const res = await client.get('/students/me/notes', { params });
  return res.data;
};

export const fetchNoteById = async (id: number): Promise<Note> => {
  const res = await client.get(`/students/me/notes/${id}`);
  return res.data;
};

export const createNote = async (data: CreateNoteData): Promise<Note> => {
  const res = await client.post('/students/me/notes', data);
  return res.data;
};

export const updateNote = async (
  id: number,
  data: UpdateNoteData,
): Promise<Note> => {
  const res = await client.put(`/students/me/notes/${id}`, data);
  return res.data;
};

export const deleteNote = async (id: number): Promise<void> => {
  await client.delete(`/students/me/notes/${id}`);
};
