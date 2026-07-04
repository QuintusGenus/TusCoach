import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSession } from '../api/coach';
import { useStopwatch, type Segment } from '../hooks/useStopwatch';
import { TUS_SUBJECTS, SUBJECT_COLORS } from '../constants/subjects';

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
  // Summary line
  let notes = `Kronometre: ${studySegs.length} çalışma, ${breakSegs.length} mola (${totalBreakMin} dk mola)`;
  // Segment details
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

interface StudyTimerProps {
  onSessionSaved?: () => void;
}

export function StudyTimer({ onSessionSaved }: StudyTimerProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>(TUS_SUBJECTS[0]);
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();

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
      Alert.alert(
        'Oturum Kaydedildi',
        `${mins} dakika ${selectedSubject} çalışması kaydedildi.`,
        [{ text: 'Tamam', onPress: () => reset() }],
      );
      onSessionSaved?.();
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.response?.data?.detail || 'Oturum kaydedilemedi');
    },
  });

  const handleStop = () => {
    if (totalStudySeconds < 60) {
      Alert.alert(
        'Süre Çok Kısa',
        'En az 1 dakika çalışmalısınız. Çalışmaya devam edin!',
        [{ text: 'Tamam' }],
      );
      return;
    }

    const mins = Math.max(1, Math.ceil(totalStudySeconds / 60));
    const breakMins = Math.round(totalBreakSeconds / 60);
    Alert.alert(
      'Çalışmayı Bitir',
      `${mins} dk çalışma${breakMins > 0 ? `, ${breakMins} dk mola` : ''} kaydedilecek. Emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Bitir ve Kaydet',
          onPress: () => {
            // Capture current segment info BEFORE stop() finalizes it
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

  return (
    <View style={styles.card}>
      {/* Subject pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.subjectScroll}
      >
        {TUS_SUBJECTS.map((sub) => {
          const isSelected = selectedSubject === sub;
          return (
            <TouchableOpacity
              key={sub}
              style={[
                styles.chip,
                isSelected && styles.chipActive,
                isLocked && !isSelected && { opacity: 0.4 },
              ]}
              onPress={() => !isLocked && setSelectedSubject(sub)}
              disabled={isLocked}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextActive,
                ]}
              >
                {sub}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Current phase indicator */}
      {currentSegmentType && timerState !== 'idle' && timerState !== 'stopped' && (
        <View style={styles.phaseRow}>
          <View
            style={[
              styles.phaseDot,
              { backgroundColor: currentSegmentType === 'study' ? '#10b981' : '#f59e0b' },
            ]}
          />
          <Text style={styles.phaseText}>
            {currentSegmentType === 'study' ? 'Çalışma' : 'Mola'}
          </Text>
          <Text style={styles.phaseTime}>{formatTime(currentSegmentSeconds)}</Text>
        </View>
      )}

      {/* Timer display */}
      <Text style={styles.timerDisplay}>{formatTime(totalStudySeconds)}</Text>
      <Text style={styles.timerLabel}>Toplam Çalışma</Text>

      {/* Break total */}
      {totalBreakSeconds > 0 && (
        <Text style={styles.breakIndicator}>
          Toplam Mola: {formatTime(totalBreakSeconds)}
        </Text>
      )}

      {/* Controls */}
      <View style={styles.controlRow}>
        {timerState === 'idle' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={start} activeOpacity={0.8}>
            <FontAwesome name="play" size={16} color="#004225" />
            <Text style={styles.primaryBtnText}>Başla</Text>
          </TouchableOpacity>
        )}

        {timerState === 'running' && (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={pause} activeOpacity={0.8}>
              <FontAwesome name="pause" size={14} color="#fff" />
              <Text style={styles.secondaryBtnText}>Duraklat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleStop} activeOpacity={0.8}>
              <FontAwesome name="stop" size={14} color="#fff" />
              <Text style={styles.dangerBtnText}>Bitir</Text>
            </TouchableOpacity>
          </>
        )}

        {timerState === 'paused' && (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={resume} activeOpacity={0.8}>
              <FontAwesome name="play" size={14} color="#004225" />
              <Text style={styles.primaryBtnText}>Devam Et</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleStop} activeOpacity={0.8}>
              <FontAwesome name="stop" size={14} color="#fff" />
              <Text style={styles.dangerBtnText}>Bitir</Text>
            </TouchableOpacity>
          </>
        )}

        {timerState === 'stopped' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.8}>
            <FontAwesome name="refresh" size={14} color="#004225" />
            <Text style={styles.primaryBtnText}>Sıfırla</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Segment details */}
      {segments.length > 0 && (
        <>
          <TouchableOpacity
            style={styles.expandToggle}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.expandText}>Detaylar</Text>
            <FontAwesome
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={10}
              color="rgba(255,255,255,0.6)"
            />
          </TouchableOpacity>

          {isExpanded &&
            segments.map((seg, i) => {
              const studyIdx = segments.slice(0, i + 1).filter((s) => s.type === 'study').length;
              const breakIdx = segments.slice(0, i + 1).filter((s) => s.type === 'break').length;
              return (
                <View key={i} style={styles.segmentRow}>
                  <View
                    style={[
                      styles.segmentDot,
                      { backgroundColor: seg.type === 'study' ? '#10b981' : '#f59e0b' },
                    ]}
                  />
                  <Text style={styles.segmentLabel}>
                    {seg.type === 'study' ? `Çalışma ${studyIdx}` : `Mola ${breakIdx}`}
                  </Text>
                  <Text style={styles.segmentDuration}>{formatTime(seg.duration)}</Text>
                </View>
              );
            })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#004225',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  subjectScroll: {
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: '#fff',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  chipTextActive: {
    color: '#004225',
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 6,
  },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  phaseText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  phaseTime: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontVariant: ['tabular-nums'],
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: '200',
    color: '#ffffff',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  breakIndicator: {
    fontSize: 14,
    color: '#f59e0b',
    textAlign: 'center',
    marginTop: 8,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#004225',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  dangerBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  expandText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 4,
    gap: 8,
  },
  segmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  segmentLabel: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  segmentDuration: {
    fontSize: 12,
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
});
