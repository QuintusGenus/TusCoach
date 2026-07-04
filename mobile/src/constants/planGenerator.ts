/**
 * Plan Generator constants — wizard questions, builder defaults, labels
 */

// ─── Wizard Steps ────────────────────────────────────────────
export const WIZARD_STEPS = ['exam_date', 'status', 'level', 'style'] as const;
export type WizardStepKey = (typeof WIZARD_STEPS)[number];

// ─── Status Options ──────────────────────────────────────────
export type UserStatus = 'new' | 'tur1_done' | 'tur2_plus';

export const STATUS_OPTIONS: { value: UserStatus; label: string; icon: string; description: string }[] = [
  { value: 'new', label: 'Yeni Başlıyorum', icon: 'school', description: 'İlk kez TUS hazırlığı yapıyorum' },
  { value: 'tur1_done', label: '1 Tur Bitti', icon: 'replay', description: 'Tüm dersleri en az 1 kez çalıştım' },
  { value: 'tur2_plus', label: '2+ Tur Bitti', icon: 'speed', description: 'Birden fazla tur tamamladım' },
];

// ─── Level Options ───────────────────────────────────────────
export type UserLevel = 'beginner' | 'intermediate' | 'advanced';

export const LEVEL_OPTIONS: { value: UserLevel; label: string; icon: string; description: string }[] = [
  { value: 'beginner', label: 'Başlangıç', icon: 'trending-up', description: 'Konulara yeni başlıyorum' },
  { value: 'intermediate', label: 'Orta', icon: 'equalizer', description: 'Çoğu konuya hakimim' },
  { value: 'advanced', label: 'İleri', icon: 'bolt', description: 'Denemelerim 150+ net' },
];

// ─── Style Options (Wizard) ──────────────────────────────────
export type StudyStyle = 'reading_heavy' | 'balanced' | 'question_heavy';

export const STYLE_OPTIONS: { value: StudyStyle; label: string; icon: string; description: string }[] = [
  { value: 'reading_heavy', label: 'Yoğun Okuma', icon: 'menu-book', description: 'Konu çalışmaya ağırlık ver' },
  { value: 'balanced', label: 'Dengeli', icon: 'balance', description: 'Okuma ve soru eşit' },
  { value: 'question_heavy', label: 'Soru Ağırlıklı', icon: 'quiz', description: 'Soru çözmeye odaklan' },
];

// ─── Builder Defaults ────────────────────────────────────────
export const BUILDER_DEFAULTS = {
  weekdayHours: 6,
  weekendHours: 4,
  studyDays: [0, 1, 2, 3, 4, 5] as number[], // Mon-Sat
  styleRatio: 50, // balanced
} as const;

// ─── Day Labels ──────────────────────────────────────────────
export const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const WEEKDAY_FULL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
