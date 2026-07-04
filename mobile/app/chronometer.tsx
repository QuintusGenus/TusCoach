import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSession } from '../src/api/coach';
import { useStopwatch, type Segment } from '../src/hooks/useStopwatch';
import { TUS_SUBJECTS, SUBJECT_COLORS } from '../src/constants/subjects';
import { colors, shadows, typography, radius } from '../src/ui/theme';

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function buildSessionNotes(segs: Segment[]): string {
  const studySegs = segs.filter((s) => s.type === 'study');
  const breakSegs = segs.filter((s) => s.type === 'break');
  const totalBreakMin = Math.round(breakSegs.reduce((sum, s) => sum + s.duration, 0) / 60);
  let notes = `Kronometre: ${studySegs.length} çalışma, ${breakSegs.length} mola (${totalBreakMin} dk mola)`;
  const details = segs.map((seg) => {
    const min = Math.floor(seg.duration / 60);
    const sec = seg.duration % 60;
    const label = seg.type === 'study' ? 'Çalışma' : 'Mola';
    return `${label} ${min}:${String(sec).padStart(2, '0')}`;
  });
  if (details.length > 0) notes += `\n${details.join(' → ')}`;
  return notes;
}

// ─── Timer Ring ─────────────────────────────────────────────
function TimerRing({
  progress,
  size = 240,
  strokeWidth = 10,
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
        <SvgGrad id="timerGrad" x1="0" y1="0" x2="1" y2="1">
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
        stroke="url(#timerGrad)"
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function ChronometerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState<string>(TUS_SUBJECTS[0]);
  const [showSegments, setShowSegments] = useState(false);

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

  const saveMutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['stats-summary'] });
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['stats-weekly'] });
      queryClient.invalidateQueries({ queryKey: ['stats-daily'] });
      const mins = Math.max(1, Math.ceil(totalStudySeconds / 60));
      Alert.alert('Oturum Kaydedildi', `${mins} dakika ${selectedSubject} çalışması kaydedildi.`, [
        { text: 'Tamam', onPress: () => { reset(); router.back(); } },
      ]);
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
  const isBreak = currentSegmentType === 'break';
  const ringProgress = timerState === 'idle' ? 0 : (currentSegmentSeconds % 3600) / 3600;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Header ────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary.main} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kronometre</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Subject Selection ────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subjectScroll}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {TUS_SUBJECTS.map((sub) => {
            const isSelected = selectedSubject === sub;
            const subColor = SUBJECT_COLORS[sub] || colors.primary.main;
            return (
              <TouchableOpacity
                key={sub}
                style={[
                  styles.subjectChip,
                  isSelected && { backgroundColor: subColor },
                  isLocked && !isSelected && { opacity: 0.3 },
                ]}
                onPress={() => !isLocked && setSelectedSubject(sub)}
                disabled={isLocked}
                activeOpacity={0.7}
              >
                <Text style={[styles.subjectChipText, isSelected && { color: colors.white }]}>
                  {sub}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ─── Timer Ring ──────────────────────────────── */}
        <View style={styles.timerSection}>
          <View style={styles.ringWrap}>
            <TimerRing progress={ringProgress} size={240} strokeWidth={10} isBreak={isBreak} />
            <View style={styles.ringCenter}>
              {currentSegmentType && timerState !== 'idle' && timerState !== 'stopped' && (
                <View style={[styles.phaseBadge, { backgroundColor: isBreak ? colors.tertiary.fixed : colors.secondary.container }]}>
                  <View style={[styles.phaseDot, { backgroundColor: isBreak ? colors.tertiary.main : colors.success }]} />
                  <Text style={[styles.phaseText, { color: isBreak ? colors.tertiary.main : colors.secondary.main }]}>
                    {isBreak ? 'Mola' : 'Çalışma'}
                  </Text>
                </View>
              )}
              <Text style={styles.timerDisplay}>{formatTime(totalStudySeconds)}</Text>
              <Text style={styles.timerLabel}>Toplam Çalışma</Text>
            </View>
          </View>

          {/* Break time */}
          {totalBreakSeconds > 0 && (
            <Text style={styles.breakText}>
              Mola: {formatTime(totalBreakSeconds)}
            </Text>
          )}
        </View>

        {/* ─── Controls ────────────────────────────────── */}
        <View style={styles.controlRow}>
          {timerState === 'idle' && (
            <TouchableOpacity style={styles.primaryBtn} onPress={start} activeOpacity={0.85}>
              <MaterialIcons name="play-arrow" size={28} color={colors.white} />
              <Text style={styles.primaryBtnText}>Başla</Text>
            </TouchableOpacity>
          )}

          {timerState === 'running' && (
            <>
              <TouchableOpacity style={styles.secondaryBtn} onPress={pause} activeOpacity={0.85}>
                <MaterialIcons name="pause" size={24} color={colors.primary.main} />
                <Text style={styles.secondaryBtnText}>Duraklat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerBtn} onPress={handleStop} activeOpacity={0.85}>
                <MaterialIcons name="stop" size={24} color={colors.white} />
                <Text style={styles.dangerBtnText}>Bitir</Text>
              </TouchableOpacity>
            </>
          )}

          {timerState === 'paused' && (
            <>
              <TouchableOpacity style={styles.primaryBtn} onPress={resume} activeOpacity={0.85}>
                <MaterialIcons name="play-arrow" size={24} color={colors.white} />
                <Text style={styles.primaryBtnText}>Devam Et</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerBtn} onPress={handleStop} activeOpacity={0.85}>
                <MaterialIcons name="stop" size={24} color={colors.white} />
                <Text style={styles.dangerBtnText}>Bitir</Text>
              </TouchableOpacity>
            </>
          )}

          {timerState === 'stopped' && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={reset} activeOpacity={0.85}>
              <MaterialIcons name="refresh" size={24} color={colors.primary.main} />
              <Text style={styles.secondaryBtnText}>Sıfırla</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Segment Details ─────────────────────────── */}
        {segments.length > 0 && (
          <View style={styles.segmentsSection}>
            <TouchableOpacity
              style={styles.segmentToggle}
              onPress={() => setShowSegments(!showSegments)}
            >
              <Text style={styles.segmentToggleText}>Detaylar</Text>
              <MaterialIcons
                name={showSegments ? 'expand-less' : 'expand-more'}
                size={20}
                color={colors.outline.main}
              />
            </TouchableOpacity>

            {showSegments && (
              <View style={styles.segmentList}>
                {segments.map((seg, i) => {
                  const studyIdx = segments.slice(0, i + 1).filter((s) => s.type === 'study').length;
                  const breakIdx = segments.slice(0, i + 1).filter((s) => s.type === 'break').length;
                  return (
                    <View key={i} style={styles.segmentRow}>
                      <View
                        style={[
                          styles.segDot,
                          { backgroundColor: seg.type === 'study' ? colors.success : colors.tertiary.fixedDim },
                        ]}
                      />
                      <Text style={styles.segLabel}>
                        {seg.type === 'study' ? `Çalışma ${studyIdx}` : `Mola ${breakIdx}`}
                      </Text>
                      <Text style={styles.segDuration}>{formatTime(seg.duration)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface.main,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.primary.main,
  },

  // Subjects
  subjectScroll: {
    marginTop: 8,
    marginBottom: 24,
  },
  subjectChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surface.containerLow,
  },
  subjectChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface.variant,
  },

  // Timer Section
  timerSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  ringWrap: {
    position: 'relative',
    width: 240,
    height: 240,
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
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: 8,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseText: {
    ...typography.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: '200',
    color: colors.onSurface.main,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerLabel: {
    ...typography.tiny,
    color: colors.onSurface.variant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  breakText: {
    ...typography.caption,
    color: colors.tertiary.main,
    marginTop: 12,
  },

  // Controls
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 32,
    paddingHorizontal: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.full,
    gap: 8,
    ...shadows.hero,
  },
  primaryBtnText: {
    ...typography.bodyBold,
    color: colors.white,
    fontSize: 16,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.containerLowest,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.full,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.outline.variant,
  },
  secondaryBtnText: {
    ...typography.bodyBold,
    color: colors.primary.main,
    fontSize: 16,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error.main,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.full,
    gap: 8,
  },
  dangerBtnText: {
    ...typography.bodyBold,
    color: colors.white,
    fontSize: 16,
  },

  // Segments
  segmentsSection: {
    marginTop: 32,
    marginHorizontal: 20,
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius.xl,
    padding: 16,
    ...shadows.sm,
  },
  segmentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  segmentToggleText: {
    ...typography.caption,
    color: colors.outline.main,
  },
  segmentList: {
    marginTop: 12,
    gap: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  segDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  segLabel: {
    flex: 1,
    ...typography.caption,
    color: colors.onSurface.main,
  },
  segDuration: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.onSurface.main,
    fontVariant: ['tabular-nums'],
  },
});
