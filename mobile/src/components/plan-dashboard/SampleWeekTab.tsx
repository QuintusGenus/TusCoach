import { View, Text, ScrollView, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SUBJECT_COLORS, type TUSSubject } from '../../constants/subjects';
import { WEEKDAY_FULL } from '../../constants/planGenerator';
import { typography, radius, shadows, useThemeColors } from '../../ui/theme';

interface SampleWeekTabProps {
  structure: any;
  dailyTasks: any[];
  selectedDate: string;
}

export function SampleWeekTab({ structure, dailyTasks, selectedDate }: SampleWeekTabProps) {
  const c = useThemeColors();

  // Build a week view from selected date (Monday of that week)
  const selected = new Date(selectedDate + 'T00:00:00');
  const dayOfWeek = selected.getDay(); // 0=Sun
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - ((dayOfWeek + 6) % 7)); // back to Monday

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date: d,
      dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      label: WEEKDAY_FULL[i],
      isToday: d.toDateString() === new Date().toDateString(),
    };
  });

  // Get active block info for the week
  const blocks = structure?.blocks || [];
  const activeBlock = blocks.find((b: any) => b.phase === 'active');

  // Build sample blocks for each day based on active block
  const buildDayBlocks = (dayIndex: number) => {
    if (!activeBlock) return [];
    const isSunday = dayIndex === 6;
    const isSaturday = dayIndex === 5;

    if (isSunday) return [{ type: 'rest', label: 'Dinlenme Günü', duration: 0, color: c.outline.variant }];

    const subject = activeBlock.subject;
    const color = SUBJECT_COLORS[subject as TUSSubject] || c.primary.main;
    const isReadingPhase = activeBlock.phase === 'active'; // simplified

    const sessionBlocks = [];
    if (isReadingPhase) {
      sessionBlocks.push({ type: 'theory', label: 'Konu Çalışma', duration: 90, color: color + '80' });
      sessionBlocks.push({ type: 'theory', label: 'Not Çıkarma', duration: 45, color: color + '60' });
      sessionBlocks.push({ type: 'qbank', label: 'Soru Çözme', duration: 30, color });
    } else {
      sessionBlocks.push({ type: 'qbank', label: 'Soru Çözme', duration: 90, color });
      sessionBlocks.push({ type: 'theory', label: 'Tekrar', duration: 30, color: color + '60' });
    }

    if (isSaturday) {
      sessionBlocks.push({ type: 'revision', label: 'Haftalık Tekrar', duration: 60, color: c.secondary.main });
    }

    return sessionBlocks;
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      {activeBlock && (
        <View style={[styles.weekHeader, { backgroundColor: c.surface.containerLow }]}>
          <MaterialIcons name="info-outline" size={16} color={c.onSurface.variant} />
          <Text style={[styles.weekHeaderText, { color: c.onSurface.variant }]}>
            Aktif ders: {activeBlock.subject} — tipik haftalık düzen
          </Text>
        </View>
      )}

      {weekDays.map((day, i) => {
        const blocks = buildDayBlocks(i);
        const isRest = blocks.length === 1 && blocks[0].type === 'rest';
        const totalMinutes = blocks.reduce((s, b) => s + b.duration, 0);

        return (
          <View
            key={day.dateStr}
            style={[
              styles.dayCard,
              { backgroundColor: c.surface.containerLowest },
              day.isToday && { borderLeftWidth: 3, borderLeftColor: c.primary.main },
            ]}
          >
            <View style={styles.dayHeader}>
              <View>
                <Text style={[styles.dayLabel, { color: day.isToday ? c.primary.main : c.onSurface.main }]}>
                  {day.label}
                </Text>
                <Text style={[styles.dayDate, { color: c.onSurface.variant }]}>
                  {day.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              {day.isToday && (
                <View style={[styles.todayBadge, { backgroundColor: c.primary.main }]}>
                  <Text style={[styles.todayText, { color: c.white }]}>BUGÜN</Text>
                </View>
              )}
              {!isRest && (
                <Text style={[styles.dayTotal, { color: c.onSurface.variant }]}>{totalMinutes} dk</Text>
              )}
            </View>

            {isRest ? (
              <View style={[styles.restBlock, { backgroundColor: c.surface.containerLow }]}>
                <MaterialIcons name="self-improvement" size={20} color={c.outline.main} />
                <Text style={[styles.restText, { color: c.outline.main }]}>Dinlenme Günü</Text>
              </View>
            ) : (
              <View style={styles.blocksRow}>
                {blocks.map((block, j) => (
                  <View key={j} style={[styles.sessionBlock, { backgroundColor: block.color + '20', borderLeftColor: block.color }]}>
                    <Text style={[styles.blockLabel, { color: c.onSurface.main }]}>{block.label}</Text>
                    <Text style={[styles.blockDuration, { color: c.onSurface.variant }]}>{block.duration} dk</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, marginBottom: 12 },
  weekHeaderText: { ...typography.caption, flex: 1 },

  dayCard: { borderRadius: radius.xl, padding: 16, marginBottom: 10, ...shadows.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dayLabel: { ...typography.bodyBold, fontSize: 16 },
  dayDate: { ...typography.caption, marginTop: 2 },
  todayBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  todayText: { ...typography.tiny, fontWeight: '700', letterSpacing: 0.5 },
  dayTotal: { ...typography.bodyBold, fontSize: 13 },

  restBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: radius.md },
  restText: { ...typography.body },

  blocksRow: { gap: 6 },
  sessionBlock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: radius.md, borderLeftWidth: 3 },
  blockLabel: { ...typography.bodyBold, fontSize: 13 },
  blockDuration: { ...typography.caption },
});
