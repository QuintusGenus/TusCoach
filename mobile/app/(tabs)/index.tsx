import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchLatestMessage,
  fetchDailyPlan,
  createSession,
  completeTask,
  fetchStatsSummary,
  fetchWeeklyStats,
} from '../../src/api/coach';
import { fetchExams } from '../../src/api/exams';
import { useAuthStore } from '../../src/state/authStore';
import { TUS_SUBJECTS, SUBJECT_COLORS } from '../../src/constants/subjects';
import { StudyTimer } from '../../src/components/StudyTimer';
import { useTimerStore } from '../../src/state/timerStore';
import { colors, shadows, typography, radius, spacing, useThemeColors, useIsDark } from '../../src/ui/theme';

// ─── Progress Ring (M3 style) ───────────────────────────────
function ProgressRing({
  progress,
  size = 160,
  strokeWidth = 12,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const offset = circumference * (1 - clamped);

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs>
        <SvgGrad id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.secondary.main} />
          <Stop offset="1" stopColor={colors.secondary.fixedDim} />
        </SvgGrad>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.surface.containerHighest}
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#ringGrad)"
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Subject Icon mapping ───────────────────────────────────
const SUBJECT_ICONS: Record<string, string> = {
  Anatomi: 'accessibility-new',
  Fizyoloji: 'monitor-heart',
  Biyokimya: 'biotech',
  Mikrobiyoloji: 'coronavirus',
  Patoloji: 'science',
  Farmakoloji: 'medication',
  Pediatri: 'child-care',
  Dahiliye: 'medical-services',
  Cerrahi: 'healing',
  'Kadın Doğum': 'pregnant-woman',
  Psikiyatri: 'psychology',
};

export default function Dashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const c = useThemeColors();
  const isDark = useIsDark();

  // ─── Queries ─────────────────────────────────────────────
  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['stats-summary'],
    queryFn: fetchStatsSummary,
    retry: false,
  });

  const { data: weeklyData, refetch: refetchWeekly } = useQuery({
    queryKey: ['stats-weekly'],
    queryFn: () => fetchWeeklyStats(8),
    retry: false,
  });

  const { data: message, isLoading: loadingMessage, refetch: refetchMessage } = useQuery({
    queryKey: ['message'],
    queryFn: fetchLatestMessage,
    retry: false,
  });

  const { data: plan, isLoading: loadingPlan, refetch: refetchPlan } = useQuery({
    queryKey: ['plan'],
    queryFn: () => fetchDailyPlan(),
    retry: false,
  });

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: () => fetchExams(1),
    retry: false,
  });

  // ─── Computed ──────────────────────────────────────────────
  const userName = user?.display_name || (user?.email ? user.email.split('@')[0] : '');
  const weekProgress = summary?.week_target_minutes
    ? Math.min(summary.week_minutes / summary.week_target_minutes, 1)
    : 0;
  const weekPercent = Math.round(weekProgress * 100);
  const weekHoursCompleted = Math.round((summary?.week_minutes || 0) / 60);
  const weekHoursTarget = summary?.week_target_minutes
    ? Math.round(summary.week_target_minutes / 60)
    : null;

  const latestExam = exams?.[0];
  const totalNet = latestExam?.breakdowns?.reduce((sum: number, b: any) => sum + (b.net || 0), 0) || 0;

  const todayTasks = plan?.tasks || [];
  const completedTasks = todayTasks.filter((t: any) => t.status === 'completed').length;
  const currentTask = todayTasks.find((t: any) => t.status !== 'completed');

  const getGreetingTime = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  const isRefreshing = loadingSummary || loadingPlan;
  const handleRefresh = () => {
    refetchSummary();
    refetchWeekly();
    refetchMessage();
    refetchPlan();
  };

  // ─── Live timer data ────────────────────────────────────────
  const liveStudySeconds = useTimerStore((s) => s.liveStudySeconds);
  const isTimerActive = useTimerStore((s) => s.isTimerActive);
  const liveMinutes = Math.floor(liveStudySeconds / 60);
  const todayMinutesDisplay = (summary?.today_minutes || 0) + (isTimerActive ? liveMinutes : 0);

  // ─── Quick subjects (top 4 for grid) ──────────────────────
  const quickSubjects = ['Biyokimya', 'Mikrobiyoloji', 'Psikiyatri', 'Pediatri'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.surface.main }]} edges={['top']}>
      {/* ─── Top App Bar ──────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={[styles.avatar, { backgroundColor: c.primary.container }]}>
            <MaterialIcons name="person" size={20} color={c.primary.onContainer} />
          </View>
          <Text style={[styles.appTitle, { color: c.primary.main }]}>TusCoach App</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/(tabs)/inbox' as any)}
          >
            <MaterialIcons name="notifications-none" size={24} color={c.primary.main} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/(tabs)/settings' as any)}
          >
            <MaterialIcons name="settings" size={24} color={c.primary.main} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={c.primary.main} />
        }
      >
        {/* ─── Welcome Section ──────────────────────────────── */}
        <View style={styles.welcomeSection}>
          <Text style={[styles.greetingLabel, { color: c.onSurface.variant }]}>{getGreetingTime()}, {userName || 'Dr.'}</Text>
          <Text style={[styles.heroTitle, { color: c.primary.main }]}>
            Bugün %{Math.round((todayMinutesDisplay / Math.max(summary?.today_target_minutes || 1, 1)) * 100)} daha odaklısın.
          </Text>
        </View>

        {/* ─── Chronometer / Study Timer ──────────────────────── */}
        <StudyTimer onSessionSaved={() => {
          refetchSummary();
          refetchPlan();
          refetchWeekly();
        }} />

        {/* ─── Weekly Progress Hero Card ────────────────────── */}
        <View style={[styles.heroCard, { backgroundColor: c.surface.containerLowest }]}>
          <View style={styles.heroContent}>
            <View style={styles.heroLeft}>
              <View style={[styles.heroBadge, { backgroundColor: c.secondary.container }]}>
                <Text style={[styles.heroBadgeText, { color: c.secondary.onContainer }]}>HAFTALIK HEDEF</Text>
              </View>
              <Text style={[styles.heroPercent, { color: c.primary.main }]}>{weekPercent}%</Text>
              <Text style={[styles.heroSubtext, { color: c.onSurface.variant }]}>
                Bu hafta {weekHoursTarget ? `${weekHoursTarget} saatlik hedefin ${weekHoursCompleted} saatini` : `${weekHoursCompleted} saat`} tamamladın.
              </Text>
            </View>
            <View style={styles.heroRing}>
              <ProgressRing progress={weekProgress} size={140} strokeWidth={12} />
              <View style={styles.heroRingCenter}>
                <MaterialIcons name="auto-awesome" size={32} color={c.secondary.main} />
              </View>
            </View>
          </View>
        </View>

        {/* ─── Daily Stats Row ──────────────────────────────── */}
        {summary && (
          <View style={[styles.statsRow, { backgroundColor: c.surface.containerLowest }]}>
            <View style={styles.statItem}>
              <MaterialIcons name="local-fire-department" size={18} color={c.tertiary.fixedDim} />
              <Text style={[styles.statValue, { color: c.primary.main }]}>{summary.streak_days}</Text>
              <Text style={[styles.statLabel, { color: c.onSurface.variant }]}>gün seri</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: c.outline.variant }]} />
            <View style={styles.statItem}>
              <MaterialIcons name="schedule" size={18} color={c.primary.fixedDim} />
              <Text style={[styles.statValue, { color: c.primary.main }]}>{todayMinutesDisplay}</Text>
              <Text style={[styles.statLabel, { color: c.onSurface.variant }]}>dk bugün</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: c.outline.variant }]} />
            <View style={styles.statItem}>
              <MaterialIcons name="check-circle" size={18} color={c.secondary.fixedDim} />
              <Text style={[styles.statValue, { color: c.primary.main }]}>{completedTasks}/{todayTasks.length}</Text>
              <Text style={[styles.statLabel, { color: c.onSurface.variant }]}>görev</Text>
            </View>
            {summary.exam_countdown_days != null && (
              <>
                <View style={[styles.statDivider, { backgroundColor: c.outline.variant }]} />
                <View style={styles.statItem}>
                  <MaterialIcons name="school" size={18} color={c.secondary.main} />
                  <Text style={[styles.statValue, { color: c.primary.main }]}>{summary.exam_countdown_days}</Text>
                  <Text style={[styles.statLabel, { color: c.onSurface.variant }]}>gün kaldı</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* ─── Motivation Quote Card ────────────────────────── */}
        <View style={[styles.quoteCard, { backgroundColor: c.primary.container }]}>
          <MaterialIcons
            name="format-quote" size={28} color={c.primary.onContainer}
            style={{ opacity: 0.3, position: 'absolute', top: 16, right: 20 }}
          />
          <Text style={[styles.quoteText, { color: c.primary.onContainer }]}>
            "Büyük işler, küçük başlangıçların disiplinli tekrarıdır."
          </Text>
          <Text style={[styles.quoteAuthor, { color: c.primary.onContainer }]}>— TUS Coach AI</Text>
        </View>

        {/* ─── Upcoming Task / Current Session ──────────────── */}
        {currentTask && (
          <TouchableOpacity style={[styles.upcomingCard, { backgroundColor: c.surface.containerLow }]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/plan')}>
            <View style={[styles.upcomingIcon, { backgroundColor: c.secondary.container }]}>
              <MaterialIcons name={(SUBJECT_ICONS[currentTask.subject || ''] || 'menu-book') as any} size={28} color={c.secondary.main} />
            </View>
            <View style={styles.upcomingContent}>
              <Text style={[styles.upcomingTitle, { color: c.primary.main }]}>
                {currentTask.subject}{currentTask.topic_name ? ` - ${currentTask.topic_name}` : ''}
              </Text>
              <Text style={[styles.upcomingMeta, { color: c.onSurface.variant }]}>
                {currentTask.phase === 'reading' ? 'Konu Çalışma' : 'Soru Çözme'} • {currentTask.target_minutes} dk
              </Text>
            </View>
            <TouchableOpacity style={[styles.playBtn, { backgroundColor: c.surface.containerLowest }]} onPress={() => router.push('/(tabs)/study' as any)}>
              <MaterialIcons name="play-arrow" size={22} color={c.primary.main} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* ─── Last Exam Summary ────────────────────────────── */}
        {latestExam && (
          <TouchableOpacity style={[styles.examCard, { backgroundColor: c.surface.containerLowest }]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/exams' as any)}>
            <View style={styles.examHeader}>
              <Text style={[styles.examLabel, { color: c.primary.main }]}>Son Deneme Özeti</Text>
              <Text style={[styles.examScore, { color: c.tertiary.main }]}>{Math.round(totalNet)} / 240 Net</Text>
            </View>
            <View style={[styles.examBar, { backgroundColor: c.surface.containerHighest }]}>
              <View style={[styles.examBarFill, { width: `${Math.min((totalNet / 240) * 100, 100)}%`, backgroundColor: c.primary.main }]} />
            </View>
            <View style={styles.examChips}>
              {latestExam.breakdowns?.slice(0, 2).map((b: any, i: number) => (
                <View key={i} style={[styles.examChip, { backgroundColor: b.net < 5 ? c.tertiary.fixed : c.secondary.container }]}>
                  <MaterialIcons name={b.net < 5 ? 'warning' : 'trending-up'} size={14} color={b.net < 5 ? c.tertiary.main : c.secondary.main} />
                  <Text style={[styles.examChipText, { color: b.net < 5 ? c.tertiary.main : c.secondary.main }]}>
                    {b.subject}: {b.net < 5 ? 'Kritik' : `+${Math.round(b.net)} Net`}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.examLink}>
              <Text style={[styles.examLinkText, { color: c.primary.main }]}>Analize Git</Text>
              <MaterialIcons name="chevron-right" size={18} color={c.primary.main} />
            </View>
          </TouchableOpacity>
        )}

        {/* ─── AI Coach Message Preview ─────────────────────── */}
        {message && (
          <TouchableOpacity style={[styles.coachCard, { backgroundColor: c.surface.containerLowest, borderColor: c.outline.variant + '33' }]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/chat')}>
            <View style={styles.coachHeader}>
              <View style={[styles.coachIcon, { backgroundColor: c.primary.container }]}>
                <MaterialIcons name="smart-toy" size={16} color={c.primary.onContainer} />
              </View>
              <Text style={[styles.coachLabel, { color: c.primary.main }]}>AI COACH ÖNERİSİ</Text>
            </View>
            <Text style={[styles.coachBody, { color: c.onSurface.main }]} numberOfLines={3}>"{message.body}"</Text>
          </TouchableOpacity>
        )}

        {/* ─── Subject Quick Access Grid ────────────────────── */}
        <View style={styles.subjectGrid}>
          {quickSubjects.map((sub) => (
            <TouchableOpacity key={sub} style={[styles.subjectCard, { backgroundColor: c.surface.containerLowest }]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/study' as any)}>
              <View style={[styles.subjectIconWrap, { backgroundColor: c.surface.containerLow }]}>
                <MaterialIcons name={(SUBJECT_ICONS[sub] || 'menu-book') as any} size={24} color={c.primary.main} />
              </View>
              <Text style={[styles.subjectName, { color: c.primary.main }]}>{sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ─── FAB ────────────────────────────────────────────── */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: c.primary.main }]} activeOpacity={0.85} onPress={() => router.push('/(tabs)/study' as any)}>
        <MaterialIcons name="add" size={28} color={c.primary.onPrimary} />
      </TouchableOpacity>
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

  // Top App Bar
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
  avatar: {
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

  // Welcome
  welcomeSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greetingLabel: {
    ...typography.caption,
    color: colors.onSurface.variant,
  },
  heroTitle: {
    ...typography.h2,
    color: colors.primary.main,
    marginTop: 4,
  },

  // Hero Progress Card
  heroCard: {
    marginHorizontal: 20,
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius['2xl'],
    padding: 24,
    ...shadows.lg,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
    marginRight: 16,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary.container,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  heroBadgeText: {
    ...typography.tiny,
    color: colors.secondary.onContainer,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroPercent: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary.main,
    marginTop: 12,
  },
  heroSubtext: {
    ...typography.caption,
    color: colors.onSurface.variant,
    marginTop: 4,
    maxWidth: 180,
  },
  heroRing: {
    position: 'relative',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Quote Card
  quoteCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.primary.container,
    borderRadius: radius['2xl'],
    padding: 24,
    overflow: 'hidden',
  },
  quoteText: {
    fontSize: 18,
    fontWeight: '600',
    fontStyle: 'italic',
    color: colors.primary.onContainer,
    lineHeight: 26,
  },
  quoteAuthor: {
    ...typography.tiny,
    color: colors.primary.onContainer,
    opacity: 0.7,
    marginTop: 12,
  },

  // Upcoming Task
  upcomingCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface.containerLow,
    borderRadius: radius['2xl'],
    borderLeftWidth: 6,
    borderLeftColor: colors.secondary.main,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  upcomingIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.secondary.container,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upcomingContent: {
    flex: 1,
  },
  upcomingTitle: {
    ...typography.bodyBold,
    color: colors.primary.main,
  },
  upcomingMeta: {
    ...typography.caption,
    color: colors.onSurface.variant,
    marginTop: 2,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.containerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },

  // Exam Summary
  examCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius['2xl'],
    padding: 20,
    ...shadows.md,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examLabel: {
    ...typography.bodyBold,
    color: colors.primary.main,
  },
  examScore: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.tertiary.main,
  },
  examBar: {
    height: 6,
    backgroundColor: colors.surface.containerHighest,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  examBarFill: {
    height: '100%',
    backgroundColor: colors.primary.main,
    borderRadius: 3,
  },
  examChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  examChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  examChipText: {
    ...typography.tiny,
    fontWeight: '600',
  },
  examLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 2,
  },
  examLinkText: {
    ...typography.bodyBold,
    color: colors.primary.main,
    fontSize: 13,
  },

  // Coach Message
  coachCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius['2xl'],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.outline.variant + '33',
    ...shadows.sm,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  coachIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.container,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachLabel: {
    ...typography.label,
    color: colors.primary.main,
    letterSpacing: 1,
  },
  coachBody: {
    ...typography.body,
    color: colors.onSurface.main,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // Subject Grid
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  subjectCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius.xl,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  subjectIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.containerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectName: {
    ...typography.bodyBold,
    color: colors.primary.main,
    fontSize: 13,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: colors.surface.containerLowest,
    borderRadius: radius.xl,
    padding: 16,
    ...shadows.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary.main,
  },
  statLabel: {
    ...typography.tiny,
    color: colors.onSurface.variant,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.outline.variant,
    opacity: 0.3,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.hero,
  },
});
