import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColors, colors } from '../../src/ui/theme';
import { getSubtopicMastery, SubtopicMasteryItem } from '../../src/api/qbank';

export default function MasteryDetailScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { subject } = useLocalSearchParams<{ subject: string }>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['qbank', 'mastery', subject],
    queryFn: () => getSubtopicMastery(subject),
    enabled: !!subject,
  });

  const barColor = (rate: number) =>
    rate >= 0.8 ? '#2E7D32' : rate >= 0.5 ? '#E65100' : '#C62828';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.surface.main }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={c.onSurface.main} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.onSurface.main }]}>{subject}</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={c.primary.main} />
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="bar-chart" size={48} color={c.outline.main} />
          <Text style={[styles.emptyText, { color: c.onSurface.variant }]}>
            Henüz bu branştan soru çözmediniz.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.sectionTitle, { color: c.onSurface.variant }]}>
            Konu bazında doğruluk oranı
          </Text>
          {data.map((item: SubtopicMasteryItem) => {
            const color = barColor(item.rate);
            return (
              <View key={item.subtopic} style={[styles.card, { backgroundColor: c.surface.container }]}>
                <View style={styles.cardRow}>
                  <Text style={[styles.subtopicName, { color: c.onSurface.main }]} numberOfLines={2}>
                    {item.subtopic}
                  </Text>
                  <Text style={[styles.rateText, { color }]}>
                    {(item.rate * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${item.rate * 100}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.stats, { color: c.onSurface.variant }]}>
                  {item.correct} / {item.attempts} doğru
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, textAlign: 'center', marginTop: 12 },
  scroll: { padding: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  subtopicName: { flex: 1, fontSize: 14, fontWeight: '600', marginRight: 8 },
  rateText: { fontSize: 14, fontWeight: '800' },
  barTrack: {
    height: 6,
    backgroundColor: colors.surface.containerHighest,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: { height: '100%', borderRadius: 3 },
  stats: { fontSize: 12 },
});
