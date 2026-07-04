export const TUS_SUBJECTS = [
  'Anatomi',
  'Fizyoloji-Histoloji',
  'Patoloji',
  'Biyokimya',
  'Mikrobiyoloji',
  'Dahiliye',
  'Pediatri',
  'Genel Cerrahi',
  'Küçük Stajlar',
  'Kadın Doğum',
  'Farmakoloji',
] as const;

export type TUSSubject = (typeof TUS_SUBJECTS)[number];

/** Short labels for compact display */
export const SUBJECT_SHORT: Record<TUSSubject, string> = {
  'Anatomi': 'ANA',
  'Fizyoloji-Histoloji': 'FİZ',
  'Patoloji': 'PAT',
  'Biyokimya': 'BİY',
  'Mikrobiyoloji': 'MİK',
  'Dahiliye': 'DAH',
  'Pediatri': 'PED',
  'Genel Cerrahi': 'CER',
  'Küçük Stajlar': 'KÜÇ',
  'Kadın Doğum': 'KAD',
  'Farmakoloji': 'FAR',
};

/** Colors for each subject (for charts/tags) */
export const SUBJECT_COLORS: Record<TUSSubject, string> = {
  'Anatomi': '#3b82f6',
  'Fizyoloji-Histoloji': '#8b5cf6',
  'Patoloji': '#ec4899',
  'Biyokimya': '#f59e0b',
  'Mikrobiyoloji': '#10b981',
  'Dahiliye': '#06b6d4',
  'Pediatri': '#f97316',
  'Genel Cerrahi': '#ef4444',
  'Küçük Stajlar': '#84cc16',
  'Kadın Doğum': '#a855f7',
  'Farmakoloji': '#14b8a6',
};
