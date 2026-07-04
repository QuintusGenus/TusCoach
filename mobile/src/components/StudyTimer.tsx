import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSession } from '../api/coach';
import { useStopwatch, type Segment } from '../hooks/useStopwatch';
import { useTimerStore } from '../state/timerStore';
import { TUS_SUBJECTS, SUBJECT_COLORS } from '../constants/subjects';
import { colors, shadows, typography, radius, useThemeColors } from '../ui/theme';

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function buildSessionNotes(segs: Segment[]): string {
  const studySegs = segs.filter((s) => s.type === 'study');
  const breakSegs = segs.filter((s) => s.type === 'break');
  const totalBreakMin = Math.round(
    breakSegs.reduce((sum, s) => sum + s.duration, 0) / 60,
  );
  let notes = `Kronometre: ${studySegs.length} çalışma, ${breakSegs.length} mola (${totalBreakMin} dk mola)`;
  const details = segs.map((seg) => {
    const min = Math.floor(seg.duration / 60);
    const sec = seg.duration % 60;
    const label = seg.type === 'study' ? 'Çalışma' : 'Mola';
    return `${label} ${min}:${String(sec).padStart(2, '0')}`;
  });
  if (details.length > 0) {
    notes += `\n${details.join(' → ')}`;
  }
  return notes;
}

// ─── Timer Ring ─────────────────────────────────────────────
function TimerRing({
  progress,
  size = 180,
  strokeWidth = 8,
  isBreak = false,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  isBreak?: boolean;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(progress % 1, 0), 1);
  const offset = circumference * (1 - clamped);

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs>
        <SvgGrad id="timerGradInline" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={isBreak ? colors.tertiary.fixedDim : colors.secondary.main} />
          <Stop offset="1" stopColor={isBreak ? colors.tertiary.main : colors.primary.main} />
        </SvgGrad>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.surface.containerHigh}
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#timerGradInline)"
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </Svg>
  );
}

interface StudyTimerProps {
  onSessionSaved?: () => void;
}

export function StudyTimer({ onSessionSaved }: StudyTimerProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>(TUS_SUBJECTS[0]);
  const queryClient = useQueryClient();
  const c = useThemeColors();

  const {
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
  } = useStopwatch();

  // Sync live seconds to global store so stats bar can read them
  const setLiveStudySeconds = useTimerStore((s) => s.setLiveStudySeconds);
  const setIsTimerActive = useTimerStore((s) => s.setIsTimerActive);
  const resetLive = useTimerStore((s) => s.resetLive);

  useEffect(() => {
    setLiveStudySeconds(totalStudySeconds);
    setIsTimerActive(timerState === 'running' || timerState === 'paused');
  }, [totalStudySeconds, timerState]);

  const saveMutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['stats-summary'] });
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['stats-weekly'] });
      queryClient.invalidateQueries({ queryKey: ['stats-daily'] });
      const mins = Math.max(1, Math.ceil(totalStudySeconds / 60));
      Alert.alert(
        'Oturum Kaydedildi',
        `${mins} dakika ${selectedSubject} çalışması kaydedildi.`,
        [{ text: 'Tamam', onPress: () => { reset(); resetLive(); } }],
      );
      onSessionSaved?.();
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.response?.data?.detail || 'Oturum kaydedilemedi');
    },
  });

  const handleStop = () => {
    if (totalStudySeconds < 60) {
      Alert.alert('Süre Çok Kısa', 'En az 1 dakika çalışmalısınız.', [{ text: 'Tamam' }]);
      return;
    }
    const mins = Math.max(1, Math.ceil(totalStudySeconds / 60));
    const breakMins = Math.round(totalBreakSeconds / 60);
    Alert.alert(
      'Çalışmayı Bitir',
      `${mins} dk çalışma${breakMins > 0 ? `, ${breakMins} dk mola` : ''} kaydedilecek.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Bitir ve Kaydet',
          onPress: () => {
            const allSegments = [...segments];
            if (currentSegmentType && currentSegmentSeconds > 0) {
              allSegments.push({ type: currentSegmentType, duration: currentSegmentSeconds });
            }
            stop();
            const today = new Date().toISOString().split('T')[0];
            saveMutation.mutate({
              date: today,
              minutes: mins,
              subject: selectedSubject,
              notes: buildSessionNotes(allSegments),
            });
          },
        },
      ],
    );
  };

  const isLocked = timerState !== 'idle';
  const isRunning = timerState === 'running';
  const isPaused = timerState === 'paused';
  const isStopped = timerState === 'stopped';
  const isIdle = timerState === 'idle';
  const isBreak = currentSegmentType === 'break';
  const ringProgress = isIdle ? 0 : (currentSegmentSeconds % 3600) / 3600;

  return (
    <View style={[styles.card, { backgroundColor: c.surface.containerLowest }]}>
      {/* ─── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <MaterialIcons name="timer" size={20} color={c.primary.main} />
        <Text style={[styles.headerTitle, { color: c.primary.main }]}>Kronometre</Text>
        {isRunning && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>ÇALIŞIYOR</Text>
          </View>
        )}
      </View>

      {/* ─── Subject Picker ──────────────────────────────── */}
      <Text style={[styles.sectionLabel, { color: c.onSurface.variant }]}>DERS SEÇİMİ</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.subjectScroll}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {TUS_SUBJECTS.map((sub) => {
          const isSelected = selectedSubject === sub;
          const subColor = SUBJECT_COLORS[sub] || colors.primary.main;
          return (
            <TouchableOpacity
              key={sub}
              style={[
                styles.subjectChip,
                isSelected && { backgroundColor: subColor, borderColor: subColor },
                isLocked && !isSelected && { opacity: 0.35 },
              ]}
              onPress={() => !isLocked && setSelectedSubject(sub)}
              disabled={isLocked}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.subjectChipText,
                  isSelected && { color: colors.white },
                ]}
              >
                {sub}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ─── Timer Display ───────────────────────────────── */}
      <View style={styles.timerSection}>
        <View style={styles.ringWrap}>
          <TimerRing progress={ringProgress} size={170} strokeWidth={8} isBreak={isBreak} />
          <View style={styles.ringCenter}>
            {/* Phase badge */}
            {!isIdle && !isStopped && currentSegmentType && (
              <View style={[styles.phaseBadge, isBreak ? styles.phaseBadgeBreak : styles.phaseBadgeStudy]}>
                <View style={[styles.phaseDot, { backgroundColor: isBreak ? colors.tertiary.main : colors.success }]} />
                <Text style={[styles.phaseLabel, { color: isBreak ? colors.tertiary.main : colors.secondary.main }]}>
                  {isBreak ? 'Mola' : 'Çalışma'}
                </Text>
              </View>
            )}
            {/* Main time */}
            <Text style={[styles.timerDisplay, { color: c.onSurface.main }]}>{formatTime(totalStudySeconds)}</Text>
            {/* Break time (smaller, below) */}
            {totalBreakSeconds > 0 ? (
              <Text style={styles.breakTime}>Mola: {formatTime(totalBreakSeconds)}</Text>
            ) : (
              <Text style={[styles.timerSubLabel, { color: c.onSurface.variant }]}>Toplam Çalışma</Text>
            )}
          </View>
        </View>
      </View>

      {/* ─── Control Buttons ─────────────────────────────── */}
      <View style={styles.controlRow}>
        {isIdle && (
          <TouchableOpacity style={styles.startBtn} onPress={start} activeOpacity={0.85}>
            <MaterialIcons name="play-arrow" size={24} color={colors.white} />
            <Text style={styles.startBtnText}>Başla</Text>
          </TouchableOpacity>
        )}

        {isRunning && (
          <>
            <TouchableOpacity style={styles.pauseBtn} onPress={pause} activeOpacity={0.85}>
              <MaterialIcons name="pause" size={22} color={colors.primary.main} />
              <Text style={styles.pauseBtnText}>Duraklat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop} activeOpacity={0.85}>
              <MaterialIcons name="stop" size={22} color={colors.white} />
              <Text style={styles.stopBtnText}>Bitir</Text>
            </TouchableOpacity>
          </>
        )}

        {isPaused && (
          <>
            <TouchableOpacity style={styles.startBtn} onPress={resume} activeOpacity={0.85}>
              <MaterialIcons name="play-arrow" size={22} color={colors.white} />
              <Text style={styles.startBtnText}>Devam Et</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop} activeOpacity={0.85}>
              <MaterialIcons name="stop" size={22} color={colors.white} />
              <Text style={styles.stopBtnText}>Bitir</Text>
            </TouchableOpacity>
          </>
        )}

        {isStopped && (
          <TouchableOpacity style={styles.pauseBtn} onPress={reset} activeOpacity={0.85}>
            <MaterialIcons name="refresh" size={22} color={colors.primary.main} />
            <Text style={styles.pauseBtnText}>Sıfırla</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Session Info (when active) ──────────────────── */}
      {!isIdle && (
        <View style={styles.sessionInfo}>
          <View style={styles.sessionInfoItem}>
            <MaterialIcons name="menu-book" size={14} color={colors.onSurface.variant} />
            <Text style={styles.sessionInfoText}>{selectedSubject}</Text>
          </View>
          {segments.length > 0 && (
            <View style={styles.sessionInfoItem}>
              <MaterialIcons name="format-list-numbered" size={14} color={colors.onSurface.variant} />
              <Text style={styles.sessionInfoText}>
                {segments.filter(s => s.type === 'study').length} çalışma, {segments.filter(s => s.type === 'break').length} mola
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius['2xl'],
    padding: 20,
    ...shadows.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.primary.main,
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.success + '1A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    ...typography.tiny,
    color: colors.success,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Subject picker
  sectionLabel: {
    ...typography.labelWide,
    color: colors.onSurface.variant,
    marginBottom: 8,
  },
  subjectScroll: {
    marginBottom: 20,
  },
  subjectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface.containerLow,
    borderWidth: 1.5,
    borderColor: colors.outline.variant + '40',
    marginRight: 8,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface.variant,
  },

  // Timer display
  timerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  ringWrap: {
    position: 'relative',
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginBottom: 4,
  },
  phaseBadgeStudy: {
    backgroundColor: colors.secondary.container,
  },
  phaseBadgeBreak: {
    backgroundColor: colors.tertiary.fixed,
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  phaseLabel: {
    ...typography.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timerDisplay: {
    fontSize: 36,
    fontWeight: '300',
    color: colors.onSurface.main,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timerSubLabel: {
    ...typography.tiny,
    color: colors.onSurface.variant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  breakTime: {
    ...typography.caption,
    color: colors.tertiary.main,
    marginTop: 2,
  },

  // Controls
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radius.full,
    gap: 6,
    ...shadows.hero,
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.containerLow,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.full,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.outline.variant,
  },
  pauseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.main,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error.main,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.full,
    gap: 6,
  },
  stopBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },

  // Session info
  sessionInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.surface.containerHigh,
  },
  sessionInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sessionInfoText: {
    ...typography.caption,
    color: colors.onSurface.variant,
  },
});
