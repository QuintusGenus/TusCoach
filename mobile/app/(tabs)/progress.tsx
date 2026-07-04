import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  fetchStatsSummary,
  fetchWeeklyStats,
  fetchDailyStats,
} from '../../src/api/coach';
import { fetchExams } from '../../src/api/exams';
import { colors, shadows, typography, radius, useThemeColors } from '../../src/ui/theme';

// ─── Donut Chart ────────────────────────────────────────────
function DonutChart({
  data,
  size = 140,
  strokeWidth = 14,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.surface.containerHighest}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {data.map((d, i) => {
          const pct = total > 0 ? d.value / total : 0;
          const dashArray = circumference;
          const dashOffset = circumference * (1 - pct);
          const rotation = (offset / total) * 360;
          offset += d.value;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={d.color}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              rotation={rotation}
              origin={`${size / 2}, ${size / 2}`}
            />
          );
        })}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary.main }}>{total}</Text>
        <Text style={{ ...typography.tiny, color: colors.onSurface.variant, textTransform: 'uppercase', letterSpacing: 1 }}>HATA</Text>
      </View>
    </View>
  );
}

// ─── Progress Bar ───────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: colors.surface.containerHighest,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});

export default function AnalyticsPage() {
  const router = useRouter();
  const c = useThemeColors();

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['stats-summary'],
    queryFn: fetchStatsSummary,
    retry: false,
  });

  const { data: weeklyData, refetch: refetchWeekly } = useQuery({
    queryKey: ['stats-weekly'],
    queryFn: () => fetchWeeklyStats(8),
    retry: false,
  });

  const {
    data: rawDaily,
    isLoading,
    refetch: refetchDaily,
  } = useQuery({
    queryKey: ['stats-daily-progress'],
    queryFn: () => fetchDailyStats(90),
    retry: false,
  });

  const { data: exams } = useQuery({
    queryKey: ['exams-analiz'],
    queryFn: () => fetchExams(5),
    retry: false,
  });

  const isRefreshing = isLoading;
  const handleRefresh = () => {
    refetchSummary();
    refetchWeekly();
    refetchDaily();
  };

  // ─── Compute error distribution from exams ────────────────
  const errorDistribution = useMemo(() => {
    if (!exams || exams.length === 0) return [];
    const errorMap: Record<string, number> = {};
    exams.forEach((exam: any) => {
      exam.breakdowns?.forEach((b: any) => {
        errorMap[b.subject] = (errorMap[b.subject] || 0) + (b.wrong || 0);
      });
    });
    const sorted = Object.entries(errorMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);
    const subjectColors: Record<string, string> = {
      Mikrobiyoloji: colors.tertiary.main,
      Farmakoloji: colors.secondary.main,
      Anatomi: colors.primary.main,
      Fizyoloji: colors.primary[400],
      Biyokimya: colors.secondary[400],
      Patoloji: colors.tertiary[400],
    };
    return sorted.map(([subject, value]) => ({
      label: subject,
      value,
      color: subjectColors[subject] || colors.outline.main,
    }));
  }, [exams]);

  const totalErrors = errorDistribution.reduce((s, d) => s + d.value, 0);

  // ─── Net trend from exams ─────────────────────────────────
  const netTrend = useMemo(() => {
    if (!exams || exams.length < 2) return null;
    const sorted = [...exams].sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const first = sorted[0]?.breakdowns?.reduce((s: number, b: any) => s + (b.net || 0), 0) || 0;
    const last =
      sorted[sorted.length - 1]?.breakdowns?.reduce((s: number, b: any) => s + (b.net || 0), 0) || 0;
    return { change: last - first, exams: sorted };
  }, [exams]);

  // ─── Daily data ───────────────────────────────────────────
  const dailyData = useMemo(() => (rawDaily || []).slice(-30), [rawDaily]);
  const totalMinutes = dailyData.reduce((s: number, d: any) => s + d.minutes, 0);
  const daysWithStudy = dailyData.filter((d: any) => d.minutes > 0).length;

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.loading, { backgroundColor: c.surface.main }]}>
        <ActivityIndicator size="large" color={c.primary.main} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: c.surface.main }]}>
      {/* ─── Top App Bar ────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={[styles.avatarWrap, { backgroundColor: c.primary.container }]}>
            <MaterialIcons name="person" size={18} color={c.primary.onContainer} />
          </View>
          <Text style={[styles.appTitle, { color: c.primary.main }]}>TusCoach App</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <MaterialIcons name="notifications" size={22} color={c.primary.main} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={c.primary.main} />}
      >
        {/* ─── Header ─────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.primary.main }]}>Performans Analizi</Text>
          <Text style={[styles.subtitle, { color: c.onSurface.variant }]}>
            Son 30 günlük gelişim verileriniz ve detaylı branş analizleriniz.
          </Text>
        </View>

        {/* ─── Net Trend Card ─────────────────────────────── */}
        {netTrend && (
          <View style={[styles.trendCard, { backgroundColor: c.surface.containerLowest }]}>
            <View style={styles.trendHeader}>
              <View>
                <Text style={[styles.trendTitle, { color: c.primary.main }]}>Net Gelişim Trendi</Text>
                <Text style={[styles.trendSubtitle, { color: c.onSurface.variant }]}>
                  Son {netTrend.exams.length} Deneme Sınavı
                </Text>
              </View>
              <View style={styles.trendBadge}>
                <Text style={styles.trendChange}>
                  {netTrend.change >= 0 ? '+' : ''}
                  {netTrend.change.toFixed(1)}
                </Text>
                <View
                  style={[
                    styles.trendPill,
                    {
                      backgroundColor:
                        netTrend.change >= 0
                          ? colors.secondary.main
                          : colors.tertiary.main,
                    },
                  ]}
                >
                  <Text style={styles.trendPillText}>
                    {netTrend.change >= 0 ? 'Artış' : 'Düşüş'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Simple bar chart of exam nets */}
            <View style={styles.barChart}>
              {netTrend.exams.map((exam: any, i: number) => {
                const net =
                  exam.breakdowns?.reduce((s: number, b: any) => s + (b.net || 0), 0) || 0;
                const maxNet = 240;
                const height = Math.max((net / maxNet) * 100, 5);
                const isLast = i === netTrend.exams.length - 1;
                return (
                  <View key={exam.id} style={styles.barCol}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${height}%`,
                          backgroundColor: isLast
                            ? colors.secondary.main
                            : colors.primary.container,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.barLabel,
                        isLast && { fontWeight: '700', color: colors.primary.main },
                      ]}
                    >
                      {isLast ? 'SON' : `D-${netTrend.exams.length - i}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Error Distribution ─────────────────────────── */}
        {errorDistribution.length > 0 && (
          <View style={[styles.errorCard, { backgroundColor: c.surface.containerLow }]}>
            <Text style={[styles.errorTitle, { color: c.primary.main }]}>Hata Dağılımı</Text>
            <View style={styles.errorContent}>
              <DonutChart data={errorDistribution} size={130} strokeWidth={14} />
              <View style={styles.errorLegend}>
                {errorDistribution.map((d) => (
                  <View key={d.label} style={styles.legendItem}>
                    <View style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                      <Text style={styles.legendLabel}>{d.label}</Text>
                    </View>
                    <Text style={styles.legendValue}>
                      %{totalErrors > 0 ? Math.round((d.value / totalErrors) * 100) : 0}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ─── AI Insights ────────────────────────────────── */}
        <View style={styles.insightsSection}>
          <View style={styles.insightsHeader}>
            <MaterialIcons name="auto-awesome" size={20} color={colors.secondary.main} />
            <Text style={[styles.insightsTitle, { color: c.primary.main }]}>Gelişim Tavsiyeleri</Text>
          </View>

          {/* Insight Card 1 */}
          {errorDistribution.length > 0 && (
            <View style={[styles.insightCard, { backgroundColor: c.surface.containerLowest, borderColor: c.surface.container }]}>
              <View style={[styles.insightStripe, { backgroundColor: colors.tertiary.main }]} />
              <View style={[styles.insightIcon, { backgroundColor: colors.tertiary.fixed }]}>
                <MaterialIcons name="biotech" size={22} color={colors.tertiary.main} />
              </View>
              <View style={styles.insightContent}>
                <View style={styles.insightTitleRow}>
                  <Text style={styles.insightCardTitle}>{errorDistribution[0].label} Odağı</Text>
                  <View style={[styles.criticalBadge, { backgroundColor: colors.tertiary.main + '1A' }]}>
                    <Text style={[styles.criticalText, { color: colors.tertiary.main }]}>KRİTİK</Text>
                  </View>
                </View>
                <Text style={styles.insightBody}>
                  Son denemelerde {errorDistribution[0].label} branşında %
                  {totalErrors > 0 ? Math.round((errorDistribution[0].value / totalErrors) * 100) : 0}{' '}
                  hata oranı var. Bu konuya odaklanmalısın.
                </Text>
              </View>
            </View>
          )}

          {/* Insight Card 2 — Trend */}
          {netTrend && netTrend.change >= 0 && (
            <View style={[styles.insightCard, { backgroundColor: c.surface.containerLowest, borderColor: c.surface.container }]}>
              <View style={[styles.insightStripe, { backgroundColor: colors.primary.main }]} />
              <View style={[styles.insightIcon, { backgroundColor: colors.primary.fixed }]}>
                <MaterialIcons name="trending-up" size={22} color={colors.primary.main} />
              </View>
              <View style={styles.insightContent}>
                <View style={styles.insightTitleRow}>
                  <Text style={styles.insightCardTitle}>Klinik Branş İvmesi</Text>
                  <View style={[styles.criticalBadge, { backgroundColor: colors.primary.main + '1A' }]}>
                    <Text style={[styles.criticalText, { color: colors.primary.main }]}>POZİTİF</Text>
                  </View>
                </View>
                <Text style={styles.insightBody}>
                  Gelişim trendindeki yükselişin stabil. Bu ivmeyi korumak için zayıf konulara ağırlık ver.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ─── Summary Stats ──────────────────────────────── */}
        {summary && (
          <View style={styles.summaryRow}>
            <View style={[styles.summaryItem, { backgroundColor: c.surface.containerLowest }]}>
              <Text style={styles.summaryValue}>{summary.streak_days}</Text>
              <Text style={styles.summaryLabel}>Gün Seri</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: c.surface.containerLowest }]}>
              <Text style={styles.summaryValue}>{totalMinutes}</Text>
              <Text style={styles.summaryLabel}>Toplam Dk</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: c.surface.containerLowest }]}>
              <Text style={styles.summaryValue}>{daysWithStudy}</Text>
              <Text style={styles.summaryLabel}>Aktif Gün</Text>
            </View>
          </View>
        )}

        {/* ─── Campaign CTA ───────────────────────────────── */}
        {errorDistribution.length > 0 && (
          <View style={[styles.campaignCard, { backgroundColor: c.primary.container }]}>
            <View style={styles.campaignBadge}>
              <Text style={styles.campaignBadgeText}>KİŞİSELLEŞTİRİLMİŞ KAMP</Text>
            </View>
            <Text style={styles.campaignTitle}>
              {errorDistribution[0].label} Hata Temizleme
            </Text>
            <Text style={styles.campaignBody}>
              Analiz ettiğimiz {totalErrors} hatanın %
              {Math.round((errorDistribution[0].value / totalErrors) * 100)}'ini oluşturan{' '}
              {errorDistribution[0].label} konusunu bu hafta sonu tamamen bitirelim.
            </Text>
            <TouchableOpacity style={styles.campaignBtn} activeOpacity={0.85}>
              <Text style={styles.campaignBtnText}>Kampı Başlat</Text>
              <MaterialIcons name="bolt" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface.main,
  },
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.main,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.fixed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary.main,
    letterSpacing: -0.5,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    ...typography.h1,
    color: colors.primary.main,
  },
  subtitle: {
    ...typography.body,
    color: colors.onSurface.variant,
    marginTop: 4,
  },

  // Trend Card
  trendCard: {
    marginHorizontal: 20,
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius['2xl'],
    padding: 24,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.surface.containerHighest,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  trendTitle: {
    ...typography.bodyBold,
    color: colors.primary.main,
    fontSize: 16,
  },
  trendSubtitle: {
    ...typography.tiny,
    color: colors.onSurface.variant,
    marginTop: 2,
  },
  trendBadge: {
    alignItems: 'flex-end',
  },
  trendChange: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.secondary.main,
  },
  trendPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 4,
  },
  trendPillText: {
    ...typography.tiny,
    color: colors.white,
  },

  // Bar Chart
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    marginTop: 20,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.containerHighest,
    paddingBottom: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '80%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    ...typography.tiny,
    color: colors.outline.main,
    marginTop: 6,
  },

  // Error Card
  errorCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface.containerLow,
    borderRadius: radius['2xl'],
    padding: 20,
  },
  errorTitle: {
    ...typography.bodyBold,
    color: colors.primary.main,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  errorLegend: {
    flex: 1,
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.onSurface.main,
  },
  legendValue: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.onSurface.main,
  },

  // Insights Section
  insightsSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  insightsTitle: {
    ...typography.h3,
    color: colors.primary.main,
    fontSize: 18,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: radius['2xl'],
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.surface.container,
    overflow: 'hidden',
  },
  insightStripe: {
    position: 'absolute',
    left: 0,
    top: 16,
    bottom: 16,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  insightIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  insightCardTitle: {
    ...typography.bodyBold,
    color: colors.onSurface.main,
  },
  criticalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  criticalText: {
    ...typography.tiny,
    fontWeight: '700',
  },
  insightBody: {
    ...typography.caption,
    color: colors.onSurface.variant,
    lineHeight: 20,
  },

  // Summary Row
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    ...shadows.sm,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary.main,
  },
  summaryLabel: {
    ...typography.tiny,
    color: colors.onSurface.variant,
    marginTop: 4,
  },

  // Campaign CTA
  campaignCard: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: colors.primary.container,
    borderRadius: radius['2xl'],
    padding: 24,
    overflow: 'hidden',
  },
  campaignBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary.onContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: 12,
  },
  campaignBadgeText: {
    ...typography.tiny,
    color: colors.primary.container,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  campaignTitle: {
    ...typography.h2,
    color: colors.primary.onContainer,
    marginBottom: 8,
  },
  campaignBody: {
    ...typography.caption,
    color: colors.primary.onContainer,
    opacity: 0.85,
    lineHeight: 20,
    marginBottom: 16,
  },
  campaignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.lg,
    gap: 6,
    ...shadows.hero,
  },
  campaignBtnText: {
    ...typography.bodyBold,
    color: colors.white,
  },
});
