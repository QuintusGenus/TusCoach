import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { WeeklyBucket } from '../api/coach';

interface Props {
  data: WeeklyBucket[];
}

export function WeeklyChart({ data }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);

  const chartHeight = 130;
  const maxVal = Math.max(
    ...data.map(d => d.minutes),
    ...data.map(d => d.target_minutes ?? 0),
    1
  );

  const formatLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
  };

  const barCount = data.length;
  const padding = 8;
  const usableWidth = containerWidth - padding * 2;
  const slotWidth = barCount > 0 ? usableWidth / barCount : 0;
  const barWidth = Math.min(slotWidth * 0.6, 28);

  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <FontAwesome name="bar-chart" size={14} color="#004225" />
          <Text style={styles.title}>Haftalık Aktivite</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalText}>{totalHours}s {totalMinutes % 60}dk</Text>
        </View>
      </View>
      <View
        style={styles.chartWrap}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={chartHeight + 24}>
            <Defs>
              <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#006d3b" stopOpacity="1" />
                <Stop offset="1" stopColor="#004225" stopOpacity="0.7" />
              </LinearGradient>
              <LinearGradient id="barGradLight" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#6ec89b" stopOpacity="1" />
                <Stop offset="1" stopColor="#b8ddc8" stopOpacity="0.8" />
              </LinearGradient>
            </Defs>
            {data.map((week, i) => {
              const barH = (week.minutes / maxVal) * chartHeight;
              const x = padding + i * slotWidth + (slotWidth - barWidth) / 2;
              const y = chartHeight - barH;
              const isLast = i === data.length - 1;

              return (
                <Rect
                  key={week.week_start}
                  x={x}
                  y={barH > 0 ? y : chartHeight - 3}
                  width={barWidth}
                  height={barH > 0 ? barH : 3}
                  fill={isLast ? 'url(#barGrad)' : 'url(#barGradLight)'}
                  rx={4}
                />
              );
            })}
            {/* Target line */}
            {data.some(d => d.target_minutes != null) && (() => {
              const avgTarget = data.reduce((s, d) => s + (d.target_minutes ?? 0), 0) / data.length;
              if (avgTarget <= 0) return null;
              const ty = chartHeight - (avgTarget / maxVal) * chartHeight;
              return (
                <Line
                  x1={padding}
                  y1={ty}
                  x2={containerWidth - padding}
                  y2={ty}
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="6,4"
                  opacity={0.5}
                />
              );
            })()}
          </Svg>
        )}
      </View>
      {/* Labels */}
      <View style={styles.labelsRow}>
        {data.map((week, i) => (
          <View key={week.week_start} style={[styles.labelSlot, { width: slotWidth }]}>
            <Text style={[styles.label, i === data.length - 1 && styles.labelActive]}>
              {formatLabel(week.week_start)}
            </Text>
            {i === data.length - 1 && (
              <View style={styles.currentDot} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#004225',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  totalBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  totalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#004225',
  },
  chartWrap: {
    width: '100%',
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  labelSlot: {
    alignItems: 'center',
  },
  label: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '500',
  },
  labelActive: {
    color: '#004225',
    fontWeight: '700',
  },
  currentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#004225',
    marginTop: 3,
  },
});
