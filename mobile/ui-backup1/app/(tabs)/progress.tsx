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
import { useQuery } from '@tanstack/react-query';
import {
  fetchStatsSummary,
  fetchWeeklyStats,
  fetchDailyStats,
} from '../../src/api/coach';
import { WeeklyChart } from '../../src/components/WeeklyChart';

const FILTER_OPTIONS = [7, 30, 90] as const;
type FilterDays = (typeof FILTER_OPTIONS)[number];

export default function ProgressPage() {
  const [filterDays, setFilterDays] = useState<FilterDays>(30);

  // Stats summary (streak, totals)
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['stats-summary'],
    queryFn: fetchStatsSummary,
    retry: false,
  });

  // Weekly chart data (always 8 weeks)
  const { data: weeklyData, refetch: refetchWeekly } = useQuery({
    queryKey: ['stats-weekly'],
    queryFn: () => fetchWeeklyStats(8),
    retry: false,
  });

  // Daily data — fetch max(filterDays, 90) so filter works client-side
  const {
    data: rawDaily,
    isLoading,
    refetch: refetchDaily,
  } = useQuery({
    queryKey: ['stats-daily-progress'],
    queryFn: () => fetchDailyStats(90),
    retry: false,
  });

  // Client-side filter: slice the last N days from the 90-day response
  const dailyData = useMemo(() => {
    if (!rawDaily) return [];
    // rawDaily is ordered oldest-first; take the last `filterDays` entries
    return rawDaily.slice(-filterDays);
  }, [rawDaily, filterDays]);

  const isRefreshing = isLoading;

  const handleRefresh = () => {
    refetchSummary();
    refetchWeekly();
    refetchDaily();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
  };

  const formatDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('tr-TR', { weekday: 'short' });
  };

  const isToday = (dateStr: string) =>
    dateStr === new Date().toISOString().split('T')[0];

  const totalMinutes = dailyData.reduce((s, d) => s + d.minutes, 0);
  const daysWithStudy = dailyData.filter(d => d.minutes > 0).length;

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#004225" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>İlerleme</Text>
        <Text style={styles.subtitle}>Çalışma yolculuğunuzu takip edin</Text>
      </View>

      {/* Summary cards */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.streak_days}</Text>
            <Text style={styles.summaryLabel}>Gün Seri</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalMinutes}</Text>
            <Text style={styles.summaryLabel}>Toplam Dk</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{daysWithStudy}</Text>
            <Text style={styles.summaryLabel}>Aktif Gün</Text>
          </View>
        </View>
      )}

      {/* Weekly Chart */}
      {weeklyData && weeklyData.length > 0 && (
        <View style={styles.section}>
          <WeeklyChart data={weeklyData} />
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.section}>
        <View style={styles.filterRow}>
          <Text style={styles.sectionTitle}>Günlük Detay</Text>
          <View style={styles.filterPills}>
            {FILTER_OPTIONS.map(days => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.filterPill,
                  filterDays === days && styles.filterPillActive,
                ]}
                onPress={() => setFilterDays(days)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterDays === days && styles.filterPillTextActive,
                  ]}
                >
                  {days}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Table header */}
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Tarih</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Dk</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Hedef</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Durum</Text>
          </View>

          {/* Table rows — show newest first */}
          {[...dailyData].reverse().map((day, i) => {
            const today = isToday(day.date);
            const met = day.target_minutes != null
              ? day.minutes >= day.target_minutes
              : day.minutes > 0;
            const hasActivity = day.minutes > 0;

            return (
              <View
                key={day.date}
                style={[
                  styles.tableRow,
                  i % 2 === 0 && styles.tableRowAlt,
                  today && styles.tableRowToday,
                ]}
              >
                <View style={{ flex: 2 }}>
                  <Text style={styles.rowDate}>
                    {formatDayName(day.date)} {formatDate(day.date)}
                  </Text>
                  {today && (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayText}>Bugün</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.rowMinutes, { flex: 1, textAlign: 'right' }]}>
                  {day.minutes}
                </Text>
                <Text style={[styles.rowTarget, { flex: 1, textAlign: 'right' }]}>
                  {day.target_minutes != null ? day.target_minutes : '-'}
                </Text>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  {day.target_minutes != null ? (
                    <View style={[styles.badge, met ? styles.badgeMet : styles.badgeNotMet]}>
                      <Text style={[styles.badgeText, met ? styles.badgeTextMet : styles.badgeTextNotMet]}>
                        {met ? 'Ulaşıldı' : 'Kaçırıldı'}
                      </Text>
                    </View>
                  ) : hasActivity ? (
                    <View style={[styles.badge, styles.badgeNeutral]}>
                      <Text style={[styles.badgeText, styles.badgeTextNeutral]}>Yapıldı</Text>
                    </View>
                  ) : (
                    <Text style={styles.rowDash}>-</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Empty state */}
      {dailyData.length > 0 && totalMinutes === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Henüz çalışma oturumu kaydedilmedi. İlerlemenizi görmek için çalışmaya başlayın!
          </Text>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  // Summary row
  summaryRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#004225',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },

  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },

  // Filter pills
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  filterPillActive: {
    backgroundColor: '#004225',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterPillTextActive: {
    color: '#fff',
  },

  // Table
  tableCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  tableRowToday: {
    backgroundColor: '#f0f7f3',
  },
  rowDate: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  rowMinutes: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  rowTarget: {
    fontSize: 13,
    color: '#6b7280',
  },
  rowDash: {
    fontSize: 13,
    color: '#d1d5db',
  },

  // Badges
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeMet: {
    backgroundColor: '#dcfce7',
  },
  badgeNotMet: {
    backgroundColor: '#fee2e2',
  },
  badgeNeutral: {
    backgroundColor: '#dceee4',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextMet: {
    color: '#16a34a',
  },
  badgeTextNotMet: {
    color: '#dc2626',
  },
  badgeTextNeutral: {
    color: '#004225',
  },

  // Today badge
  todayBadge: {
    backgroundColor: '#004225',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  todayText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
