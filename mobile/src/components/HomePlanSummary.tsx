import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { SUBJECT_COLORS, type TUSSubject } from '../constants/subjects';
import { typography, radius, shadows, useThemeColors } from '../ui/theme';
import type { PlanOverview, PlanStructure, SubjectBlock } from '../api/coach';

interface Props {
  overview?: PlanOverview | null;
  structure?: PlanStructure | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (s: string) => new Date(s + 'T00:00:00');
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK_LABELS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

type DayInfo = { subject: string; phase: 'reading' | 'question'; color: string };

/** Map each plan day → subject + phase (reading days come first in each block). */
function buildDayMap(blocks: SubjectBlock[]): Record<string, DayInfo> {
  const map: Record<string, DayInfo> = {};
  for (const b of blocks) {
    const color = SUBJECT_COLORS[b.subject as TUSSubject] || '#6f7979';
    const start = toDate(b.start_date);
    const total = b.reading_days + b.question_days;
    for (let i = 0; i < total; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      map[toKey(d)] = { subject: b.subject, phase: i < b.reading_days ? 'reading' : 'question', color };
    }
  }
  return map;
}

/**
 * Compact program summary for the home screen: active block, week progress,
 * a color-coded strip of the current week, and overall completion. Taps → Program.
 * Renders nothing when there is no active plan.
 */
export function HomePlanSummary({ overview, structure }: Props) {
  const c = useThemeColors();
  const router = useRouter();

  const blocks = structure?.blocks ?? [];
  if (!overview?.id || blocks.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toKey(today);
  const dayMap = buildDayMap(blocks);

  const activeBlock =
    blocks.find((b) => b.phase === 'active') ||
    blocks.find((b) => toDate(b.start_date) <= today && today <= toDate(b.end_date)) ||
    blocks[0];
  const activeColor = SUBJECT_COLORS[activeBlock.subject as TUSSubject] || c.primary.main;

  const start = toDate(overview.start_date);
  const end = toDate(overview.end_date);
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const elapsedDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
  const weekIndex = Math.min(totalWeeks, Math.max(1, Math.floor(elapsedDays / 7) + 1));

  const completionPct =
    overview.total_tasks > 0 ? Math.round((overview.completed_tasks / overview.total_tasks) * 100) : 0;

  // Current week, Monday-first
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekDays = [...Array(7)].map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.surface.containerLowest }]}
      activeOpacity={0.8}
      onPress={() => router.push('/(tabs)/plan')}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: c.onSurface.variant }]}>PROGRAMIN</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.link, { color: c.primary.main }]}>Tümü</Text>
          <MaterialIcons name="chevron-right" size={18} color={c.primary.main} />
        </View>
      </View>

      {/* Active block + week */}
      <View style={styles.activeRow}>
        <View style={[styles.dot, { backgroundColor: activeColor }]} />
        <Text style={[styles.activeSubject, { color: c.onSurface.main }]} numberOfLines={1}>
          {activeBlock.subject}
        </Text>
        <Text style={[styles.weekTag, { color: c.onSurface.variant }]}>
          Hafta {weekIndex} / {totalWeeks}
        </Text>
      </View>

      {/* Week strip */}
      <View style={styles.strip}>
        {weekDays.map((d, i) => {
          const key = toKey(d);
          const info = dayMap[key];
          const isToday = key === todayKey;
          const bg = info
            ? info.phase === 'reading' ? info.color + '33' : info.color
            : c.surface.containerHigh;
          const txt = info && info.phase === 'question' ? c.white : c.onSurface.variant;
          return (
            <View key={key} style={styles.stripCol}>
              <Text style={[styles.stripLabel, { color: c.onSurface.variant }]}>{WEEK_LABELS[i]}</Text>
              <View
                style={[
                  styles.stripCell,
                  { backgroundColor: bg },
                  isToday && { borderWidth: 2, borderColor: c.primary.main },
                ]}
              >
                <Text style={[styles.stripDay, { color: txt }, isToday && { fontWeight: '800' }]}>
                  {d.getDate()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Overall progress */}
      <View style={styles.progressRow}>
        <View style={[styles.progressTrack, { backgroundColor: c.surface.containerHigh }]}>
          <View style={[styles.progressFill, { width: `${completionPct}%`, backgroundColor: c.primary.main }]} />
        </View>
        <Text style={[styles.progressPct, { color: c.onSurface.variant }]}>%{completionPct}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 16, padding: 16, borderRadius: radius['2xl'], ...shadows.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { ...typography.labelWide },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  link: { ...typography.caption, fontWeight: '700' },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  activeSubject: { ...typography.bodyBold, flex: 1 },
  weekTag: { ...typography.caption },
  strip: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  stripCol: { alignItems: 'center', gap: 4, flex: 1 },
  stripLabel: { ...typography.tiny },
  stripCell: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  stripDay: { fontSize: 12, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressPct: { ...typography.caption, fontWeight: '700', minWidth: 38, textAlign: 'right' },
});
