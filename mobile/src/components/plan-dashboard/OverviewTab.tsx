import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SUBJECT_COLORS, type TUSSubject } from '../../constants/subjects';
import { typography, radius, shadows, useThemeColors } from '../../ui/theme';

interface OverviewTabProps {
  overview: any;
  structure: any;
  onRegenerate: () => void;
}

export function OverviewTab({ overview, structure, onRegenerate }: OverviewTabProps) {
  const c = useThemeColors();

  if (!overview) return null;

  const startDate = new Date(overview.start_date + 'T00:00:00');
  const endDate = new Date(overview.end_date + 'T00:00:00');
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.ceil(totalDays / 7);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const weeksRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)));
  const completionPct = overview.total_tasks > 0 ? Math.round((overview.completed_tasks / overview.total_tasks) * 100) : 0;
  const blocks = structure?.blocks || [];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      {/* Progress Card */}
      <View style={[styles.progressCard, { backgroundColor: c.primary.container }]}>
        <View style={styles.progressRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.progressLabel, { color: c.primary.onContainer }]}>İlerleme</Text>
            <Text style={[styles.progressPercent, { color: c.primary.onContainer }]}>{completionPct}%</Text>
            <Text style={[styles.progressDetail, { color: c.primary.onContainer }]}>
              {overview.completed_tasks} / {overview.total_tasks} görev tamamlandı
            </Text>
          </View>
          <TouchableOpacity onPress={onRegenerate} style={[styles.regenBtn, { backgroundColor: c.primary.main }]}>
            <MaterialIcons name="refresh" size={18} color={c.white} />
          </TouchableOpacity>
        </View>
        <View style={[styles.progressBar, { backgroundColor: c.primary.main + '30' }]}>
          <View style={[styles.progressFill, { width: `${completionPct}%`, backgroundColor: c.primary.onContainer }]} />
        </View>
      </View>

      {/* Stat Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: c.surface.containerLowest }]}>
          <MaterialIcons name="date-range" size={22} color={c.primary.main} />
          <Text style={[styles.statValue, { color: c.primary.main }]}>{weeksRemaining}</Text>
          <Text style={[styles.statLabel, { color: c.onSurface.variant }]}>hafta kaldı</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface.containerLowest }]}>
          <MaterialIcons name="today" size={22} color={c.secondary.main} />
          <Text style={[styles.statValue, { color: c.secondary.main }]}>{totalDays}</Text>
          <Text style={[styles.statLabel, { color: c.onSurface.variant }]}>toplam gün</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface.containerLowest }]}>
          <MaterialIcons name="school" size={22} color={c.tertiary.main} />
          <Text style={[styles.statValue, { color: c.tertiary.main }]}>{blocks.length}</Text>
          <Text style={[styles.statLabel, { color: c.onSurface.variant }]}>ders bloğu</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface.containerLowest }]}>
          <MaterialIcons name="flag" size={22} color={c.success} />
          <Text style={[styles.statValue, { color: c.success }]}>{overview.tur_number || '-'}</Text>
          <Text style={[styles.statLabel, { color: c.onSurface.variant }]}>tur no</Text>
        </View>
      </View>

      {/* Phase Timeline */}
      {blocks.length > 0 && (
        <View style={[styles.timelineCard, { backgroundColor: c.surface.containerLowest }]}>
          <Text style={[styles.timelineTitle, { color: c.onSurface.main }]}>Ders Bloğu Zaman Çizelgesi</Text>
          {blocks.map((block: any, i: number) => {
            const color = SUBJECT_COLORS[block.subject as TUSSubject] || c.outline.main;
            const isActive = block.phase === 'active';
            const isDone = block.phase === 'completed';
            const totalBlockDays = block.reading_days + block.question_days;
            const startD = new Date(block.start_date + 'T00:00:00');
            const endD = new Date(block.end_date + 'T00:00:00');
            const startStr = startD.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
            const endStr = endD.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

            return (
              <View key={i} style={styles.timelineRow}>
                {/* Dot + Line */}
                <View style={styles.timelineDotCol}>
                  <View style={[styles.timelineDot, { backgroundColor: isDone ? c.success : isActive ? color : c.outline.variant }]} />
                  {i < blocks.length - 1 && <View style={[styles.timelineLine, { backgroundColor: c.surface.containerHighest }]} />}
                </View>
                {/* Content */}
                <View style={[styles.timelineContent, isActive && { backgroundColor: color + '15', borderRadius: radius.md, padding: 10, marginLeft: -4 }]}>
                  <View style={styles.timelineHeader}>
                    <Text style={[styles.timelineSubject, { color: isActive ? color : isDone ? c.outline.main : c.onSurface.main }]}>
                      {block.order}. {block.subject}
                    </Text>
                    {isActive && (
                      <View style={[styles.activeBadge, { backgroundColor: color }]}>
                        <Text style={[styles.activeBadgeText, { color: c.white }]}>AKTİF</Text>
                      </View>
                    )}
                    {isDone && <MaterialIcons name="check-circle" size={16} color={c.success} />}
                  </View>
                  <Text style={[styles.timelineMeta, { color: c.onSurface.variant }]}>
                    {startStr} — {endStr} • {block.reading_days} okuma + {block.question_days} soru
                  </Text>
                  {/* Block bar */}
                  <View style={styles.blockBar}>
                    <View style={[styles.blockBarReading, { flex: block.reading_days, backgroundColor: color + '60' }]} />
                    <View style={[styles.blockBarQuestion, { flex: block.question_days, backgroundColor: color }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  // Progress
  progressCard: { borderRadius: radius['2xl'], padding: 20, marginBottom: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  progressLabel: { ...typography.labelWide, opacity: 0.7, marginBottom: 4 },
  progressPercent: { fontSize: 36, fontWeight: '800' },
  progressDetail: { ...typography.caption, opacity: 0.8, marginTop: 2 },
  regenBtn: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  progressBar: { height: 6, borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, minWidth: '45%', alignItems: 'center', padding: 16,
    borderRadius: radius.xl, gap: 6, ...shadows.sm,
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Timeline
  timelineCard: { borderRadius: radius['2xl'], padding: 20, ...shadows.sm },
  timelineTitle: { ...typography.bodyBold, fontSize: 16, marginBottom: 16 },
  timelineRow: { flexDirection: 'row', marginBottom: 6 },
  timelineDotCol: { alignItems: 'center', width: 24, marginRight: 12 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: 12 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineSubject: { ...typography.bodyBold, flex: 1 },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  activeBadgeText: { ...typography.tiny, fontWeight: '700', letterSpacing: 0.5 },
  timelineMeta: { ...typography.caption, marginTop: 2 },
  blockBar: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8, gap: 1 },
  blockBarReading: { borderRadius: 2 },
  blockBarQuestion: { borderRadius: 2 },
});
