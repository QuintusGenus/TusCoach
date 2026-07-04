import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { DailyBucket } from '../api/coach';

interface Props {
  data: DailyBucket[];
}

export function DailyMiniChart({ data }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);

  const chartHeight = 48;
  const maxVal = Math.max(...data.map(d => d.minutes), 1);

  const padding = 4;
  const usableWidth = containerWidth - padding * 2;
  const slotWidth = data.length > 0 ? usableWidth / data.length : 0;
  const barWidth = Math.max(slotWidth * 0.7, 2);

  const isToday = (dateStr: string) =>
    dateStr === new Date().toISOString().split('T')[0];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Son {data.length} Gün</Text>
        <Text style={styles.subtitle}>
          {data.reduce((s, d) => s + d.minutes, 0)} dk toplam
        </Text>
      </View>
      <View
        style={styles.chartWrap}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={chartHeight}>
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
                  fill={today ? '#004225' : day.minutes > 0 ? '#b8ddc8' : '#e5e7eb'}
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
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  chartWrap: {
    width: '100%',
  },
});
