import { View, Text, ScrollView, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SUBJECT_COLORS, type TUSSubject } from '../../constants/subjects';
import { typography, radius, shadows, useThemeColors } from '../../ui/theme';

interface SubjectsTabProps {
  structure: any;
}

export function SubjectsTab({ structure }: SubjectsTabProps) {
  const c = useThemeColors();
  const blocks: any[] = structure?.blocks || [];

  if (blocks.length === 0) {
    return (
      <View style={styles.empty}>
        <MaterialIcons name="school" size={40} color={c.outline.variant} />
        <Text style={[styles.emptyText, { color: c.onSurface.variant }]}>Henüz ders bloğu yok.</Text>
      </View>
    );
  }

  const maxDays = Math.max(...blocks.map((b: any) => b.reading_days + b.question_days));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionTitle, { color: c.onSurface.main }]}>Ders Dağılımı</Text>
      <Text style={[styles.sectionSubtitle, { color: c.onSurface.variant }]}>
        {blocks.length} ders bloğu • Her bloğun okuma ve soru günleri
      </Text>

      {blocks.map((block: any, i: number) => {
        const color = SUBJECT_COLORS[block.subject as TUSSubject] || c.primary.main;
        const totalDays = block.reading_days + block.question_days;
        const barWidth = maxDays > 0 ? (totalDays / maxDays) * 100 : 0;
        const isDone = block.phase === 'completed';
        const isActive = block.phase === 'active';

        const startD = new Date(block.start_date + 'T00:00:00');
        const endD = new Date(block.end_date + 'T00:00:00');
        const weeks = Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24 * 7));

        return (
          <View key={i} style={[styles.subjectCard, { backgroundColor: c.surface.containerLowest }]}>
            <View style={styles.subjectHeader}>
              <View style={[styles.colorDot, { backgroundColor: color }]} />
              <Text style={[styles.subjectName, { color: c.onSurface.main }, isDone && { color: c.outline.main, textDecorationLine: 'line-through' }]}>
                {block.subject}
              </Text>
              {/* Phase badge */}
              <View style={[
                styles.phaseBadge,
                {
                  backgroundColor: isDone ? c.success + '20' : isActive ? color + '20' : c.surface.containerHigh,
                },
              ]}>
                <Text style={[
                  styles.phaseBadgeText,
                  { color: isDone ? c.success : isActive ? color : c.onSurface.variant },
                ]}>
                  {isDone ? 'Tamamlandı' : isActive ? 'Aktif' : 'Bekliyor'}
                </Text>
              </View>
            </View>

            {/* Weight bar */}
            <View style={styles.barRow}>
              <View style={[styles.barTrack, { backgroundColor: c.surface.containerHighest }]}>
                <View style={styles.barFillRow}>
                  <View style={[styles.barFillReading, { flex: block.reading_days, backgroundColor: color + '60' }]} />
                  <View style={[styles.barFillQuestion, { flex: block.question_days, backgroundColor: color }]} />
                </View>
              </View>
              <Text style={[styles.barDays, { color: c.onSurface.variant }]}>{totalDays} gün</Text>
            </View>

            {/* Meta row */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <MaterialIcons name="menu-book" size={14} color={c.onSurface.variant} />
                <Text style={[styles.metaText, { color: c.onSurface.variant }]}>{block.reading_days} okuma</Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons name="quiz" size={14} color={c.onSurface.variant} />
                <Text style={[styles.metaText, { color: c.onSurface.variant }]}>{block.question_days} soru</Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons name="date-range" size={14} color={c.onSurface.variant} />
                <Text style={[styles.metaText, { color: c.onSurface.variant }]}>~{weeks} hafta</Text>
              </View>
            </View>
          </View>
        );
      })}

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: c.surface.containerLow }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: c.primary.main + '60' }]} />
          <Text style={[styles.legendText, { color: c.onSurface.variant }]}>Okuma</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: c.primary.main }]} />
          <Text style={[styles.legendText, { color: c.onSurface.variant }]}>Soru</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingBottom: 60 },
  emptyText: { ...typography.body },

  sectionTitle: { ...typography.h3, marginBottom: 4 },
  sectionSubtitle: { ...typography.caption, marginBottom: 16 },

  subjectCard: { borderRadius: radius.xl, padding: 16, marginBottom: 10, ...shadows.sm },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  subjectName: { ...typography.bodyBold, flex: 1 },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  phaseBadgeText: { ...typography.tiny, fontWeight: '700' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFillRow: { flexDirection: 'row', height: '100%' },
  barFillReading: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  barFillQuestion: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  barDays: { ...typography.caption, fontWeight: '700', minWidth: 45, textAlign: 'right' },

  metaRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.caption },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, padding: 12, borderRadius: radius.md, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 14, height: 8, borderRadius: 2 },
  legendText: { ...typography.caption },
});
