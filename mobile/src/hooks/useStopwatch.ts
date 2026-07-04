import { useState, useRef, useCallback, useEffect } from 'react';

export type TimerState = 'idle' | 'running' | 'paused' | 'stopped';

export interface Segment {
  type: 'study' | 'break';
  duration: number; // seconds
}

export function useStopwatch() {
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [, setTick] = useState(0); // force re-renders

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentStartRef = useRef<number | null>(null);
  const segmentTypeRef = useRef<'study' | 'break' | null>(null);
  const accStudyMsRef = useRef(0);
  const accBreakMsRef = useRef(0);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startInterval = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 100);
  }, []);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finalizeSegment = useCallback(() => {
    if (!segmentStartRef.current || !segmentTypeRef.current) return;
    const elapsed = Date.now() - segmentStartRef.current;
    const type = segmentTypeRef.current;
    if (type === 'study') {
      accStudyMsRef.current += elapsed;
    } else {
      accBreakMsRef.current += elapsed;
    }
    setSegments((prev) => [
      ...prev,
      { type, duration: Math.round(elapsed / 1000) },
    ]);
    segmentStartRef.current = null;
    segmentTypeRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (timerState !== 'idle') return;
    accStudyMsRef.current = 0;
    accBreakMsRef.current = 0;
    setSegments([]);
    segmentStartRef.current = Date.now();
    segmentTypeRef.current = 'study';
    setTimerState('running');
    startInterval();
  }, [timerState, startInterval]);

  const pause = useCallback(() => {
    if (timerState !== 'running') return;
    finalizeSegment();
    segmentStartRef.current = Date.now();
    segmentTypeRef.current = 'break';
    setTimerState('paused');
  }, [timerState, finalizeSegment]);

  const resume = useCallback(() => {
    if (timerState !== 'paused') return;
    finalizeSegment();
    segmentStartRef.current = Date.now();
    segmentTypeRef.current = 'study';
    setTimerState('running');
  }, [timerState, finalizeSegment]);

  const stop = useCallback(() => {
    if (timerState !== 'running' && timerState !== 'paused') return;
    finalizeSegment();
    stopInterval();
    setTimerState('stopped');
  }, [timerState, finalizeSegment, stopInterval]);

  const reset = useCallback(() => {
    stopInterval();
    accStudyMsRef.current = 0;
    accBreakMsRef.current = 0;
    segmentStartRef.current = null;
    segmentTypeRef.current = null;
    setSegments([]);
    setTimerState('idle');
  }, [stopInterval]);

  // Compute current elapsed
  const currentSegmentMs =
    segmentStartRef.current ? Date.now() - segmentStartRef.current : 0;

  const totalStudySeconds = Math.floor(
    (accStudyMsRef.current +
      (segmentTypeRef.current === 'study' ? currentSegmentMs : 0)) /
      1000,
  );

  const totalBreakSeconds = Math.floor(
    (accBreakMsRef.current +
      (segmentTypeRef.current === 'break' ? currentSegmentMs : 0)) /
      1000,
  );

  const currentSegmentSeconds = Math.floor(currentSegmentMs / 1000);
  const currentSegmentType = segmentTypeRef.current;

  return {
    timerState,
    segments,
    totalStudySeconds,
    totalBreakSeconds,
    currentSegmentSeconds,
    currentSegmentType,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
