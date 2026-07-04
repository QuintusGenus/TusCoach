/**
 * TurMapper — maps user inputs to a tur_number (1-4) for the backend API.
 * Also computes dynamic plan duration estimates based on hours/days.
 */
import type { UserStatus, UserLevel, StudyStyle } from '../../constants/planGenerator';

export interface WizardInputs {
  examDate: Date | null;
  status: UserStatus;
  level: UserLevel;
  style: StudyStyle;
}

export interface BuilderInputs {
  examDate: Date | null;
  weekdayHours: number;
  weekendHours: number;
  studyDays: number[];
  excludedDates: string[];
  status: UserStatus;
  level: UserLevel;
  styleRatio: number;
}

export interface TurResult {
  turNumber: number;
  label: string;
  estimatedDays: number;
  estimatedWeeks: number;
  totalStudyHours: number;
  avgHoursPerDay: number;
  reasoning: string;
}

const TUR_INFO: Record<number, { label: string; baseDays: number }> = {
  1: { label: '1. Tur — Yeni Başlayan', baseDays: 72 },
  2: { label: '2. Tur — Tekrar', baseDays: 55 },
  3: { label: '3. Tur — Hızlı Tekrar', baseDays: 38 },
  4: { label: '4. Tur — Sprint', baseDays: 25 },
};

// Total study hours needed per tur (benchmark: 6h/day baseline)
const TUR_TOTAL_HOURS: Record<number, number> = {
  1: 432,  // 72 days * 6h
  2: 330,  // 55 days * 6h
  3: 228,  // 38 days * 6h
  4: 150,  // 25 days * 6h
};

function daysUntilExam(examDate: Date | null): number | null {
  if (!examDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exam = new Date(examDate);
  exam.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function baseTurFromStatus(status: UserStatus, level: UserLevel): { tur: number; reasoning: string } {
  if (status === 'new') {
    if (level === 'advanced') return { tur: 2, reasoning: 'İlk tur ama güçlü temel var — hızlı geçiş planı' };
    return { tur: 1, reasoning: 'İlk kez çalışma — kapsamlı temel plan' };
  }
  if (status === 'tur1_done') {
    if (level === 'advanced') return { tur: 3, reasoning: '1 tur tamamlandı, ileri seviye — hızlı tekrar' };
    return { tur: 2, reasoning: '1 tur tamamlandı — derinleştirme planı' };
  }
  // tur2_plus
  if (level === 'beginner') return { tur: 2, reasoning: 'Çoklu tur ama hâlâ gelişim aşamasında' };
  if (level === 'intermediate') return { tur: 3, reasoning: '2+ tur, orta seviye — hızlı tekrar' };
  return { tur: 4, reasoning: '2+ tur, ileri seviye — sprint planı' };
}

function applyTimeConstraint(tur: number, examDate: Date | null): { tur: number; override: string | null } {
  const days = daysUntilExam(examDate);
  if (days === null) return { tur, override: null };
  if (days <= 25 && tur < 4) return { tur: 4, override: `Sınava ${days} gün kaldı — sprint zorunlu` };
  if (days <= 38 && tur < 3) return { tur: 3, override: `Sınava ${days} gün kaldı — hızlı tekrar` };
  if (days <= 55 && tur < 2) return { tur: 2, override: `Sınava ${days} gün kaldı — sıkıştırılmış plan` };
  return { tur, override: null };
}

export function mapWizardToTur(inputs: WizardInputs): TurResult {
  let { tur, reasoning } = baseTurFromStatus(inputs.status, inputs.level);
  const { tur: constrained, override } = applyTimeConstraint(tur, inputs.examDate);
  if (override) { tur = constrained; reasoning = override; }

  const info = TUR_INFO[tur];
  return {
    turNumber: tur,
    label: info.label,
    estimatedDays: info.baseDays,
    estimatedWeeks: Math.ceil(info.baseDays / 7),
    totalStudyHours: TUR_TOTAL_HOURS[tur],
    avgHoursPerDay: 6,
    reasoning,
  };
}

/**
 * Compute dynamic plan duration based on user's actual available study hours.
 * Core idea: each tur needs X total hours. User provides Y hours/week.
 * estimatedWeeks = totalHoursNeeded / hoursPerWeek
 */
export function mapBuilderToTur(inputs: BuilderInputs): TurResult {
  let { tur, reasoning } = baseTurFromStatus(inputs.status, inputs.level);
  const { tur: constrained, override } = applyTimeConstraint(tur, inputs.examDate);
  if (override) { tur = constrained; reasoning = override; }

  const info = TUR_INFO[tur];
  const totalHoursNeeded = TUR_TOTAL_HOURS[tur];

  // Calculate weekly study hours from actual day selection
  const weekdayCount = inputs.studyDays.filter(d => d < 5).length; // Mon-Fri
  const weekendCount = inputs.studyDays.filter(d => d >= 5).length; // Sat-Sun
  const hoursPerWeek = (weekdayCount * inputs.weekdayHours) + (weekendCount * inputs.weekendHours);

  // Account for excluded dates (reduce total available weeks proportionally)
  const excludedWeeks = inputs.excludedDates.length / 7;

  const estimatedWeeks = hoursPerWeek > 0
    ? Math.ceil(totalHoursNeeded / hoursPerWeek) + Math.ceil(excludedWeeks)
    : info.baseDays / 7;

  const estimatedDays = estimatedWeeks * inputs.studyDays.length;
  const avgHoursPerDay = inputs.studyDays.length > 0
    ? hoursPerWeek / inputs.studyDays.length
    : 0;

  return {
    turNumber: tur,
    label: info.label,
    estimatedDays: Math.round(estimatedDays),
    estimatedWeeks: Math.round(estimatedWeeks),
    totalStudyHours: totalHoursNeeded,
    avgHoursPerDay: Math.round(avgHoursPerDay * 10) / 10,
    reasoning,
  };
}

export function getTurInfo(turNumber: number) {
  return TUR_INFO[turNumber] || TUR_INFO[1];
}
