import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SUBJECT_COLORS, type TUSSubject } from '../../constants/subjects';
import { typography, radius, shadows, useThemeColors } from '../../ui/theme';

interface Block {
  subject: string;
  start_date: string;
  end_date: string;
  reading_days: number;
  question_days: number;
}

interface MonthCalendarProps {
  blocks: Block[];
  startDate: string; // plan start (YYYY-MM-DD)
  endDate: string;   // plan end (YYYY-MM-DD)
}

type DayInfo = { subject: string; phase: 'reading' | 'question'; color: string };

const toDate = (s: string) => new Date(s + 'T00:00:00');
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/** Map every plan day to its subject + phase (reading days come first in each block). */
function buildDayMap(blocks: Block[]): Record<string, DayInfo> {
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

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const WEEK_LABELS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

export function MonthCalendar({ blocks, startDate, endDate }: MonthCalendarProps) {
  const c = useThemeColors();
  const dayMap = useMemo(() => buildDayMap(blocks), [blocks]);

  const planStart = toDate(startDate);
  const planEnd = toDate(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toKey(today);

  // Start on the month containing today (if in plan), else the plan's first month.
  const firstMonth = monthKey(planStart);
  const lastMonth = monthKey(planEnd);
  const initialMonth =
    monthKey(today) >= firstMonth && monthKey(today) <= lastMonth ? monthKey(today) : firstMonth;

  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [selectedKey, setSelectedKey] = useState<string>(
    dayMap[todayKey] ? todayKey : startDate,
  );

  const year = Math.floor(viewMonth / 12);
  const month = viewMonth % 12;
  const firstOfMonth = new Date(year, month, 1);
  const startPad = (firstOfMonth.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selected = dayMap[selectedKey];
  const selectedDate = toDate(selectedKey);

  return (
    <View style={[styles.card, { backgroundColor: c.surface.containerLowest }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.onSurface.main }]}>Takvim</Text>
        <View style={styles.nav}>
          <TouchableOpacity
            onPress={() => setViewMonth((m) => Math.max(firstMonth, m - 1))}
            disabled={viewMonth <= firstMonth}
            style={[styles.navBtn, viewMonth <= firstMonth && { opacity: 0.3 }]}
          >
            <MaterialIcons name="chevron-left" size={22} color={c.primary.main} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: c.onSurface.main }]}>
            {MONTH_NAMES[month]} {year}
          </Text>
          <TouchableOpacity
            onPress={() => setViewMonth((m) => Math.min(lastMonth, m + 1))}
            disabled={viewMonth >= lastMonth}
            style={[styles.navBtn, viewMonth >= lastMonth && { opacity: 0.3 }]}
          >
            <MaterialIcons name="chevron-right" size={22} color={c.primary.main} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Weekday labels */}
      <View style={styles.weekRow}>
        {WEEK_LABELS.map((w) => (
          <Text key={w} style={[styles.weekLabel, { color: c.onSurface.variant }]}>{w}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`pad-${i}`} style={styles.cell} />;
          const d = new Date(year, month, day);
          const key = toKey(d);
          const info = dayMap[key];
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;

          // Reading days: soft tint. Question days: full color. Off-plan: bare.
          const bg = info
            ? info.phase === 'reading' ? info.color + '33' : info.color
            : 'transparent';
          const txt = info
            ? info.phase === 'question' ? c.white : c.onSurface.main
            : c.onSurface.variant;

          return (
            <TouchableOpacity
              key={key}
              style={styles.cell}
              onPress={() => setSelectedKey(key)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.dayInner,
                  { backgroundColor: bg },
                  isSelected && { borderWidth: 2, borderColor: c.onSurface.main },
                  isToday && !isSelected && { borderWidth: 2, borderColor: c.primary.main },
                ]}
              >
                <Text style={[styles.dayText, { color: txt }, isToday && { fontWeight: '800' }]}>{day}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: c.onSurface.variant + '55' }]} />
          <Text style={[styles.legendText, { color: c.onSurface.variant }]}>Okuma</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: c.onSurface.variant }]} />
          <Text style={[styles.legendText, { color: c.onSurface.variant }]}>Soru</Text>
        </View>
      </View>

      {/* Selected-day caption */}
      <View style={[styles.caption, { backgroundColor: c.surface.containerLow }]}>
        {selected ? (
          <>
            <View style={[styles.captionDot, { backgroundColor: selected.color }]} />
            <Text style={[styles.captionText, { color: c.onSurface.main }]}>
              {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]} · {selected.subject}
              {'  '}
              <Text style={{ color: c.onSurface.variant }}>
                {selected.phase === 'reading' ? 'Okuma günü' : 'Soru günü'}
              </Text>
            </Text>
          </>
        ) : (
          <Text style={[styles.captionText, { color: c.onSurface.variant }]}>
            {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]} · Plan dışı gün
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius['2xl'], padding: 20, marginBottom: 16, ...shadows.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { ...typography.bodyBold, fontSize: 16 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  monthLabel: { ...typography.bodyBold, fontSize: 14, minWidth: 110, textAlign: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLabel: { flex: 1, textAlign: 'center', ...typography.tiny, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayInner: { flex: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontSize: 13, fontWeight: '600' },
  legend: { flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 4 },
  legendText: { ...typography.tiny },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: radius.md },
  captionDot: { width: 10, height: 10, borderRadius: 5 },
  captionText: { ...typography.caption, flex: 1 },
});
