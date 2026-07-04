import { create } from 'zustand';

interface TimerStore {
  /** Seconds of study time accumulated in the current active chrono session */
  liveStudySeconds: number;
  /** Whether the chrono is actively running */
  isTimerActive: boolean;
  setLiveStudySeconds: (seconds: number) => void;
  setIsTimerActive: (active: boolean) => void;
  resetLive: () => void;
}

export const useTimerStore = create<TimerStore>((set) => ({
  liveStudySeconds: 0,
  isTimerActive: false,
  setLiveStudySeconds: (seconds) => set({ liveStudySeconds: seconds }),
  setIsTimerActive: (active) => set({ isTimerActive: active }),
  resetLive: () => set({ liveStudySeconds: 0, isTimerActive: false }),
}));
