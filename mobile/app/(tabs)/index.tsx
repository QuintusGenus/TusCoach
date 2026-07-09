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
  fetchPlanOverview,
  fetchPlanStructure,
} from '../../src/api/coach';
import { fetchExams } from '../../src/api/exams';
import { useAuthStore } from '../../src/state/authStore';
import { StudyTimer } from '../../src/components/StudyTimer';
import { HomePlanSummary } from '../../src/components/HomePlanSummary';
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
  const c = useThemeColors();
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const offset = circumference * (1 - clamped);

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs>
        <SvgGrad id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.primary.main} />
          <Stop offset="1" stopColor={c.secondary.main} />
        </SvgGrad>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={c.surface.containerHighest}
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

  const { data: planOverview } = useQuery({
    queryKey: ['plan-overview'],
    queryFn: fetchPlanOverview,
    retry: false,
  });

  const { data: planStructure } = useQuery({
    queryKey: ['plan-structure'],
    queryFn: fetchPlanStructure,
    enabled: !!planOverview?.id,
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
  const pendingTasks = todayTasks.filter((t: any) => t.status !== 'completed');
  const currentTask = pendingTasks[0];
  const nextTask = pendingTasks[1];

  const now = new Date();
  const todayLabel = `${now.toLocaleDateString('tr-TR', { weekday: 'long' })}, ${now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`;

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.surface.main }]} edges={['top']}>
      {/* ─── Header (date · greeting · avatar) ────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerDate, { color: c.onSurface.variant }]}>{todayLabel}</Text>
          <Text style={[styles.headerGreeting, { color: c.onSurface.main }]}>
            {getGreetingTime()}, {userName || 'Dr.'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: c.surface.containerLow }]}
          onPress={() => router.push('/(tabs)/inbox' as any)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="notifications-none" size={22} color={c.onSurface.variant} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerAvatar, { backgroundColor: c.primary.container }]}
          onPress={() => router.push('/(tabs)/settings' as any)}
          activeOpacity={0.8}
        >
          <Text style={[styles.headerAvatarText, { color: c.primary.onContainer }]}>
            {(userName || 'D').charAt(0).toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={c.primary.main} />
        }
      >
        {/* ─── ŞİMDİ ODAKLAN — focus hero ───────────────────── */}
        <View style={[styles.focusHero, { backgroundColor: c.primary.main }]}>
          <MaterialIcons
            name="auto-awesome" size={120} color={c.primary.onPrimary}
            style={styles.focusHeroGlyph}
          />
          <Text style={[styles.focusEyebrow, { color: c.primary.onPrimary }]}>ŞİMDİ ODAKLAN</Text>
          <Text style={[styles.focusSubject, { color: c.primary.onPrimary }]}>
            {currentTask?.subject || 'Serbest çalışma'}
          </Text>
          <Text style={[styles.focusMeta, { color: c.primary.onPrimary }]}>
            {currentTask
              ? `${currentTask.topic_name && currentTask.topic_name !== 'Genel' ? currentTask.topic_name + ' · ' : ''}${currentTask.phase === 'reading' ? 'Konu çalışma' : 'Soru çözme'} · ${currentTask.target_minutes} dk`
              : 'Kronometreyi başlat, oturumunu kaydet'}
          </Text>
          <View style={styles.focusActions}>
            <TouchableOpacity
              style={[styles.focusStartBtn, { backgroundColor: c.primary.onPrimary }]}
              activeOpacity={0.85}
              onPress={() => router.push(
                (currentTask?.subject ? `/chronometer?subject=${encodeURIComponent(currentTask.subject)}` : '/chronometer') as any,
              )}
            >
              <MaterialIcons name="play-arrow" size={24} color={c.primary.main} />
              <Text style={[styles.focusStartText, { color: c.primary.main }]}>Başla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.focusTimerBtn, { borderColor: c.primary.onPrimary + '55' }]}
              activeOpacity={0.7}
              onPress={() => router.push('/chronometer' as any)}
            >
              <MaterialIcons name="timer" size={22} color={c.primary.onPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Haftalık Hedef ───────────────────────────────── */}
        <View style={[styles.goalCard, { backgroundColor: c.surface.containerLowest }]}>
          <View style={styles.goalRing}>
            <ProgressRing progress={weekProgress} size={64} strokeWidth={7} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.goalLabel, { color: c.onSurface.variant }]}>Haftalık Hedef</Text>
            <Text style={[styles.goalValue, { color: c.onSurface.main }]}>
              {weekHoursCompleted}
              <Text style={[styles.goalValueDim, { color: c.onSurface.variant }]}> / {weekHoursTarget ?? '—'} saat</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.goalRemain, { color: c.primary.main }]}>
              {weekHoursTarget ? Math.max(0, weekHoursTarget - weekHoursCompleted) : weekPercent}
              {!weekHoursTarget && '%'}
            </Text>
            <Text style={[styles.goalRemainLabel, { color: c.onSurface.variant }]}>
              {weekHoursTarget ? 'saat kaldı' : 'tamam'}
            </Text>
          </View>
        </View>

        {/* ─── Quiet stat cards ─────────────────────────────── */}
        <View style={styles.statCardsRow}>
          <View style={[styles.statCard, { backgroundColor: c.surface.containerLowest }]}>
            <MaterialIcons name="local-fire-department" size={20} color={c.tertiary.fixedDim} />
            <Text style={[styles.statCardValue, { color: c.onSurface.main }]}>{summary?.streak_days ?? 0}</Text>
            <Text style={[styles.statCardLabel, { color: c.onSurface.variant }]}>gün seri</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: c.surface.containerLowest }]}>
            <MaterialIcons name="timer" size={20} color={c.primary.main} />
            <Text style={[styles.statCardValue, { color: c.onSurface.main }]}>{todayMinutesDisplay}</Text>
            <Text style={[styles.statCardLabel, { color: c.onSurface.variant }]}>dk bugün</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: c.surface.containerLowest }]}>
            <MaterialIcons name="task-alt" size={20} color={c.secondary.main} />
            <Text style={[styles.statCardValue, { color: c.onSurface.main }]}>{completedTasks}/{todayTasks.length}</Text>
            <Text style={[styles.statCardLabel, { color: c.onSurface.variant }]}>görev</Text>
          </View>
        </View>

        {/* ─── Sıradaki görev ───────────────────────────────── */}
        {nextTask && (
          <TouchableOpacity style={[styles.nextCard, { backgroundColor: c.surface.containerLow }]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/plan')}>
            <View style={[styles.nextIcon, { backgroundColor: c.secondary.container }]}>
              <MaterialIcons name={(SUBJECT_ICONS[nextTask.subject || ''] || 'menu-book') as any} size={22} color={c.secondary.main} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.nextEyebrow, { color: c.onSurface.variant }]}>SIRADAKİ GÖREV</Text>
              <Text style={[styles.nextTitle, { color: c.onSurface.main }]} numberOfLines={1}>
                {nextTask.subject}{nextTask.topic_name && nextTask.topic_name !== 'Genel' ? ` · ${nextTask.topic_name}` : ''}
              </Text>
              <Text style={[styles.nextMeta, { color: c.onSurface.variant }]}>
                {nextTask.phase === 'reading' ? 'Konu çalışma' : 'Soru çözme'} · {nextTask.target_minutes} dk
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={c.outline.main} />
          </TouchableOpacity>
        )}

        {/* ─── AI coach nudge ───────────────────────────────── */}
        {message && (
          <TouchableOpacity
            style={[styles.nudge, { backgroundColor: c.primary.container }]}
            activeOpacity={0.75}
            onPress={() => router.push('/(tabs)/chat')}
          >
            <View style={[styles.nudgeIcon, { backgroundColor: c.primary.main }]}>
              <MaterialIcons name="auto-awesome" size={18} color={c.primary.onPrimary} />
            </View>
            <Text style={[styles.nudgeText, { color: c.primary.onContainer }]} numberOfLines={2}>
              {message.body}
            </Text>
            <MaterialIcons name="chevron-right" size={22} color={c.primary.onContainer} />
          </TouchableOpacity>
        )}

        {/* ─── Program summary + week strip ─────────────────── */}
        <HomePlanSummary overview={planOverview} structure={planStructure} />

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

  // ── Odak header ──
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerDate: { ...typography.caption, textTransform: 'capitalize' },
  headerGreeting: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 1 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { fontSize: 16, fontWeight: '800' },

  // ── ŞİMDİ ODAKLAN hero ──
  focusHero: {
    marginHorizontal: 20, marginTop: 4, marginBottom: 16,
    borderRadius: radius['2xl'], padding: 22, overflow: 'hidden', ...shadows.hero,
  },
  focusHeroGlyph: { position: 'absolute', right: -18, top: -14, opacity: 0.12 },
  focusEyebrow: { ...typography.labelWide, opacity: 0.8, marginBottom: 8 },
  focusSubject: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  focusMeta: { ...typography.body, opacity: 0.85, marginTop: 4 },
  focusActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  focusStartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    flex: 1, paddingVertical: 15, borderRadius: radius.full,
  },
  focusStartText: { fontSize: 16, fontWeight: '800' },
  focusTimerBtn: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Haftalık Hedef ──
  goalCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 16, padding: 16,
    borderRadius: radius['2xl'], ...shadows.sm,
  },
  goalRing: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' },
  goalLabel: { ...typography.caption },
  goalValue: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  goalValueDim: { fontSize: 14, fontWeight: '600' },
  goalRemain: { fontSize: 24, fontWeight: '800' },
  goalRemainLabel: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Stat cards ──
  statCardsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 16 },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: 16, gap: 6,
    borderRadius: radius.xl, ...shadows.sm,
  },
  statCardValue: { fontSize: 22, fontWeight: '800' },
  statCardLabel: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Sıradaki görev ──
  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 16, padding: 14, borderRadius: radius.xl,
  },
  nextIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  nextEyebrow: { ...typography.tiny, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  nextTitle: { ...typography.bodyBold },
  nextMeta: { ...typography.caption, marginTop: 1 },

  // ── AI nudge ──
  nudge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 16, padding: 14, borderRadius: radius.xl,
  },
  nudgeIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  nudgeText: { ...typography.caption, flex: 1, lineHeight: 18 },

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
