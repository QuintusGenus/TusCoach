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

/** Canonical tur rotation order for study planning */
export const TUS_SUBJECT_ORDER: readonly TUSSubject[] = [
  'Fizyoloji-Histoloji',
  'Patoloji',
  'Dahiliye',
  'Biyokimya',
  'Pediatri',
  'Anatomi',
  'Genel Cerrahi',
  'Kadın Doğum',
  'Küçük Stajlar',
  'Mikrobiyoloji',
  'Farmakoloji',
];

/** Tur (round) options for plan generation */
export const TUR_OPTIONS = [
  { value: 1, label: 'Yeni Başlayan (1. Tur)', description: '~72 gün', days: 72 },
  { value: 2, label: '2. Tur', description: '~55 gün', days: 55 },
  { value: 3, label: '3. Tur', description: '~38 gün', days: 38 },
  { value: 4, label: '4. Tur', description: '~25 gün', days: 25 },
] as const;

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
