import { client } from './client';

export interface CalendarEvent {
  type: 'session' | 'exam' | 'task';
  date: string;
  title: string;
  subject: string | null;
  minutes: number | null;
  score: number | null;
  status: string | null;
}

export const fetchCalendarEvents = async (
  start: string,
  end: string,
): Promise<CalendarEvent[]> => {
  const res = await client.get('/students/me/calendar', {
    params: { start, end },
  });
  return res.data;
};
