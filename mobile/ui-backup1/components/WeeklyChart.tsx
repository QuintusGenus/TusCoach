import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import type { WeeklyBucket } from '../api/coach';

interface Props {
  data: WeeklyBucket[];
}

export function WeeklyChart({ data }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);

  const chartHeight = 120;
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
  const barWidth = Math.min(slotWidth * 0.65, 30);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Haftalık Aktivite</Text>
      <View
        style={styles.chartWrap}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={chartHeight + 24}>
            {data.map((week, i) => {
              const barH = (week.minutes / maxVal) * chartHeight;
              const x = padding + i * slotWidth + (slotWidth - barWidth) / 2;
              const y = chartHeight - barH;
              const isLast = i === data.length - 1;

              return (
                <Rect
                  key={week.week_start}
                  x={x}
                  y={barH > 0 ? y : chartHeight - 2}
                  width={barWidth}
                  height={barH > 0 ? barH : 2}
                  fill={isLast ? '#004225' : '#85c5a3'}
                  rx={3}
                />
              );
            })}
            {/* Target line (use first non-null target as reference) */}
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
                  strokeWidth={1}
                  strokeDasharray="4,4"
                  opacity={0.6}
                />
              );
            })()}
          </Svg>
        )}
      </View>
      {/* Labels row */}
      <View style={styles.labelsRow}>
        {data.map((week, i) => (
          <View key={week.week_start} style={[styles.labelSlot, { width: slotWidth }]}>
            <Text style={[styles.label, i === data.length - 1 && styles.labelActive]}>
              {formatLabel(week.week_start)}
            </Text>
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
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  chartWrap: {
    width: '100%',
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 2,
    paddingHorizontal: 8,
  },
  labelSlot: {
    alignItems: 'center',
  },
  label: {
    fontSize: 9,
    color: '#9ca3af',
  },
  labelActive: {
    color: '#004225',
    fontWeight: '600',
  },
});
