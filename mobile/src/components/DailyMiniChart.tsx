import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, shadows, typography } from '../ui/theme';
import type { DailyBucket } from '../api/coach';

interface Props {
  data: DailyBucket[];
  examCountdownDays?: number | null;
}

export function DailyMiniChart({ data, examCountdownDays }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);

  const chartHeight = 52;
  const maxVal = Math.max(...data.map(d => d.minutes), 1);

  const padding = 4;
  const usableWidth = containerWidth - padding * 2;
  const slotWidth = data.length > 0 ? usableWidth / data.length : 0;
  const barWidth = Math.max(slotWidth * 0.7, 2);

  const isToday = (dateStr: string) =>
    dateStr === new Date().toISOString().split('T')[0];

  const activeDays = data.filter(d => d.minutes > 0).length;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <FontAwesome name="calendar" size={13} color={colors.primary[500]} />
          <Text style={styles.title}>
            {examCountdownDays != null ? `SINAVA SON ${examCountdownDays} GÜN` : `SON ${data.length} GÜN`}
          </Text>
        </View>
        <View style={styles.statsRight}>
          <View style={styles.statPill}>
            <Text style={styles.statPillText}>{activeDays} aktif gun</Text>
          </View>
          <Text style={styles.subtitle}>
            {data.reduce((s, d) => s + d.minutes, 0)} dk
          </Text>
        </View>
      </View>
      <View
        style={styles.chartWrap}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={chartHeight}>
            <Defs>
              <LinearGradient id="todayGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary[500]} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.primary[700]} stopOpacity="0.8" />
              </LinearGradient>
            </Defs>
            {data.map((day, i) => {
              const barH = (day.minutes / maxVal) * (chartHeight - 4);
              const x = padding + i * slotWidth + (slotWidth - barWidth) / 2;
              const y = chartHeight - barH;
              const today = isToday(day.date);

              return (
                <Rect
                  key={day.date}
                  x={x}
                  y={barH > 0 ? y : chartHeight - 2}
                  width={barWidth}
                  height={barH > 0 ? barH : 2}
                  fill={today ? 'url(#todayGrad)' : day.minutes > 0 ? colors.primary[200] : colors.gray[200]}
                  rx={2}
                />
              );
            })}
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    ...shadows.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    ...typography.caption,
    color: colors.gray[800],
    textTransform: 'uppercase',
  },
  statsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statPill: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statPillText: {
    ...typography.label,
    color: colors.primary[500],
  },
  subtitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.gray[500],
  },
  chartWrap: {
    width: '100%',
  },
});
