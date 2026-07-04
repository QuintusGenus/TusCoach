import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery } from '@tanstack/react-query';
import { fetchCalendarEvents, CalendarEvent } from '../src/api/calendar';
import { colors, shadows, typography } from '../src/ui/theme';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const EVENT_COLORS: Record<string, string> = {
  session: colors.info,
  exam: colors.danger,
  task: colors.success,
};

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Monday = 0, Sunday = 6
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  const days: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function formatYMD(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export default function CalendarScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const startDate = formatYMD(year, month, 1);
  const endDate = formatYMD(year, month, new Date(year, month + 1, 0).getDate());

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events', startDate, endDate],
    queryFn: () => fetchCalendarEvents(startDate, endDate),
  });

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [events]);

  const days = getMonthDays(year, month);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedDateStr = selectedDay ? formatYMD(year, month, selectedDay) : null;
  const selectedEvents = selectedDateStr ? eventsByDate[selectedDateStr] || [] : [];

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDay(null);
  }

  const formatSelectedDate = () => {
    if (!selectedDay) return '';
    const d = new Date(year, month, selectedDay);
    return d.toLocaleDateString('tr-TR', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Takvim', headerShown: true }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <FontAwesome name="chevron-left" size={18} color={colors.gray[700]} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[month]} {year}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <FontAwesome name="chevron-right" size={18} color={colors.gray[700]} />
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={styles.weekText}>{w}</Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calGrid}>
          {days.map((day, idx) => {
            if (day === null) {
              return <View key={`empty-${idx}`} style={styles.dayCell} />;
            }
            const dateStr = formatYMD(year, month, day);
            const isToday = dateStr === todayStr;
            const isSelected = day === selectedDay;
            const dayEvents = eventsByDate[dateStr] || [];
            const uniqueTypes = [...new Set(dayEvents.map((e) => e.type))];

            return (
              <TouchableOpacity
                key={`day-${day}`}
                style={[
                  styles.dayCell,
                  isToday && styles.dayCellToday,
                  isSelected && !isToday && styles.dayCellSelected,
                ]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayText,
                    isToday && styles.dayTextToday,
                  ]}
                >
                  {day}
                </Text>
                {uniqueTypes.length > 0 && (
                  <View style={styles.dotsRow}>
                    {uniqueTypes.slice(0, 3).map((t) => (
                      <View
                        key={t}
                        style={[
                          styles.dot,
                          { backgroundColor: isToday ? colors.white : EVENT_COLORS[t] || colors.gray[500] },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Date Events */}
        <ScrollView style={styles.eventsList}>
          {selectedDay && (
            <Text style={styles.eventsTitle}>{formatSelectedDate()}</Text>
          )}
          {isLoading && <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary[500]} />}
          {!isLoading && selectedEvents.length === 0 && selectedDay && (
            <Text style={styles.noEvents}>Bu günde etkinlik yok</Text>
          )}
          {selectedEvents.map((ev, i) => (
            <View key={i} style={styles.eventRow}>
              <View
                style={[
                  styles.eventDot,
                  { backgroundColor: EVENT_COLORS[ev.type] || colors.gray[500] },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{ev.title}</Text>
                <View style={styles.eventMeta}>
                  <Text style={styles.eventType}>{ev.type}</Text>
                  {ev.subject && <Text style={styles.eventSubject}>{ev.subject}</Text>}
                  {ev.minutes != null && (
                    <Text style={styles.eventDetail}>{ev.minutes} min</Text>
                  )}
                  {ev.score != null && (
                    <Text style={styles.eventDetail}>Net: {ev.score}</Text>
                  )}
                  {ev.status && <Text style={styles.eventDetail}>{ev.status}</Text>}
                </View>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[100] },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 18, fontWeight: '600', color: colors.gray[900] },

  // Weekday headers
  weekRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  weekText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[400],
  },

  // Calendar grid
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  dayCellToday: {
    backgroundColor: colors.primary[500],
    borderRadius: 12,
  },
  dayCellSelected: {
    backgroundColor: colors.primary[50],
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  dayText: { fontSize: 14, color: colors.gray[700], fontWeight: '500' },
  dayTextToday: { color: colors.white, fontWeight: '700' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },

  // Events list
  eventsList: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  eventsTitle: { fontSize: 16, fontWeight: '600', color: colors.gray[900], marginBottom: 12 },
  noEvents: { fontSize: 14, color: colors.gray[400], textAlign: 'center', marginTop: 20 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  eventDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: colors.gray[900] },
  eventMeta: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  eventType: {
    fontSize: 11,
    color: colors.gray[500],
    backgroundColor: colors.gray[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  eventSubject: {
    fontSize: 11,
    color: colors.primary[500],
    backgroundColor: colors.primary[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  eventDetail: { fontSize: 11, color: colors.gray[500] },
});
