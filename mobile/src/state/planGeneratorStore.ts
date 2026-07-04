import { create } from 'zustand';
import type { UserStatus, UserLevel, StudyStyle } from '../constants/planGenerator';
import { BUILDER_DEFAULTS } from '../constants/planGenerator';
import { TUS_SUBJECT_ORDER } from '../constants/subjects';

interface PlanGeneratorStore {
  mode: 'wizard' | 'builder' | null;
  setMode: (mode: 'wizard' | 'builder' | null) => void;

  wizardStep: number;
  setWizardStep: (step: number) => void;

  // Shared
  examDate: Date | null;
  status: UserStatus | null;
  level: UserLevel | null;
  style: StudyStyle | null;
  setExamDate: (date: Date | null) => void;
  setStatus: (status: UserStatus) => void;
  setLevel: (level: UserLevel) => void;
  setStyle: (style: StudyStyle) => void;

  // Builder
  weekdayHours: number;
  weekendHours: number;
  studyDays: number[];
  styleRatio: number;
  excludedDates: string[]; // YYYY-MM-DD strings (shift days, holidays)
  subjectOrder: string[];
  setWeekdayHours: (hours: number) => void;
  setWeekendHours: (hours: number) => void;
  setStudyDays: (days: number[]) => void;
  setStyleRatio: (ratio: number) => void;
  toggleExcludedDate: (date: string) => void;
  clearExcludedDates: () => void;
  setSubjectOrder: (order: string[]) => void;
  moveSubject: (fromIndex: number, toIndex: number) => void;

  reset: () => void;
}

export const usePlanGeneratorStore = create<PlanGeneratorStore>((set, get) => ({
  mode: null,
  wizardStep: 0,
  examDate: null,
  status: null,
  level: null,
  style: null,
  weekdayHours: BUILDER_DEFAULTS.weekdayHours,
  weekendHours: BUILDER_DEFAULTS.weekendHours,
  studyDays: [...BUILDER_DEFAULTS.studyDays],
  styleRatio: BUILDER_DEFAULTS.styleRatio,
  excludedDates: [],
  subjectOrder: [...TUS_SUBJECT_ORDER],

  setMode: (mode) => set({ mode }),
  setWizardStep: (wizardStep) => set({ wizardStep }),
  setExamDate: (examDate) => set({ examDate }),
  setStatus: (status) => set({ status }),
  setLevel: (level) => set({ level }),
  setStyle: (style) => set({ style }),
  setWeekdayHours: (weekdayHours) => set({ weekdayHours }),
  setWeekendHours: (weekendHours) => set({ weekendHours }),
  setStudyDays: (studyDays) => set({ studyDays }),
  setStyleRatio: (styleRatio) => set({ styleRatio }),
  toggleExcludedDate: (date) => {
    const current = get().excludedDates;
    if (current.includes(date)) {
      set({ excludedDates: current.filter((d) => d !== date) });
    } else {
      set({ excludedDates: [...current, date] });
    }
  },
  clearExcludedDates: () => set({ excludedDates: [] }),
  setSubjectOrder: (subjectOrder) => set({ subjectOrder }),
  moveSubject: (fromIndex, toIndex) => {
    const order = [...get().subjectOrder];
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    set({ subjectOrder: order });
  },

  reset: () =>
    set({
      mode: null,
      wizardStep: 0,
      examDate: null,
      status: null,
      level: null,
      style: null,
      weekdayHours: BUILDER_DEFAULTS.weekdayHours,
      weekendHours: BUILDER_DEFAULTS.weekendHours,
      studyDays: [...BUILDER_DEFAULTS.studyDays],
      styleRatio: BUILDER_DEFAULTS.styleRatio,
      excludedDates: [],
      subjectOrder: [...TUS_SUBJECT_ORDER],
    }),
}));
