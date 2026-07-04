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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLatestMessage,
  fetchDailyPlan,
  createSession,
  completeTask,
  updatePlanTask,
  deletePlanTask,
  createPlanTask,
  fetchStatsSummary,
  fetchWeeklyStats,
  fetchDailyStats,
} from '../../src/api/coach';
import type { UpdateTaskData, CreateTaskData } from '../../src/api/coach';
import { CoachCard } from '../../src/components/CoachCard';
import { PlanList } from '../../src/components/PlanList';
import { WeeklyChart } from '../../src/components/WeeklyChart';
import { DailyMiniChart } from '../../src/components/DailyMiniChart';
import { StudyTimer } from '../../src/components/StudyTimer';
import { useAuthStore } from '../../src/state/authStore';
import { TUS_SUBJECTS, SUBJECT_COLORS } from '../../src/constants/subjects';

const toLocalDateStr = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Dashboard() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);

  // Query: Latest coach message
  const { data: message, isLoading: loadingMessage, refetch: refetchMessage } = useQuery({
    queryKey: ['message'],
    queryFn: fetchLatestMessage,
    retry: false
  });

  // Query: Today's plan
  const { data: plan, isLoading: loadingPlan, refetch: refetchPlan } = useQuery({
    queryKey: ['plan'],
    queryFn: () => fetchDailyPlan(),
    retry: false
  });

  // Plan mutations (for home screen quick actions)
  const completeTaskMut = useMutation({
    mutationFn: completeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
    },
  });
  const updateTaskMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskData }) =>
      updatePlanTask(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] }),
  });
  const createTaskMut = useMutation({
    mutationFn: (data: CreateTaskData) => createPlanTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
    },
    onError: (err: any) => {
      Alert.alert('Hata', err.response?.data?.detail || 'Görev oluşturulamadı');
    },
  });
  const deleteTaskMut = useMutation({
    mutationFn: deletePlanTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
    },
  });

  // Query: Stats summary
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['stats-summary'],
    queryFn: fetchStatsSummary,
    retry: false,
  });

  // Query: Weekly stats (8 weeks)
  const { data: weeklyData, refetch: refetchWeekly } = useQuery({
    queryKey: ['stats-weekly'],
    queryFn: () => fetchWeeklyStats(8),
    retry: false,
  });

  // Query: Daily stats (14 days)
  const { data: dailyData, refetch: refetchDaily } = useQuery({
    queryKey: ['stats-daily'],
    queryFn: () => fetchDailyStats(14),
    retry: false,
  });

  const queryClient = useQueryClient();

  // Quick Add Session Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>(TUS_SUBJECTS[0]);
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');

  // Mutation: Create session
  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      setMinutes('');
      setNotes('');
      setSelectedSubject(TUS_SUBJECTS[0]);
      setShowAddModal(false);
      refetchPlan();
      refetchSummary();
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      Alert.alert('Başarılı', 'Çalışma oturumu eklendi!');
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.response?.data?.detail || 'Oturum eklenemedi');
    }
  });

  const handleAddSession = () => {
    const minutesNum = parseInt(minutes, 10);

    if (!minutes || isNaN(minutesNum) || minutesNum < 1) {
      Alert.alert('Hata', 'Lütfen geçerli dakika girin (1-1000)');
      return;
    }

    if (minutesNum > 1000) {
      Alert.alert('Hata', 'Maksimum 1000 dakika');
      return;
    }

    const today = toLocalDateStr(new Date());

    createSessionMutation.mutate({
      date: today,
      minutes: minutesNum,
      subject: selectedSubject,
      notes: notes.trim() || undefined
    });
  };

  const isRefreshing = loadingMessage || loadingPlan;

  const handleRefresh = () => {
    refetchMessage();
    refetchPlan();
    refetchSummary();
    refetchWeekly();
    refetchDaily();
  };

  const userName = user?.display_name || (user?.email ? user.email.split('@')[0] : '');

  return (
    <>
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Hero Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {userName ? `Merhaba, ${userName}` : 'Merhaba'}!
            </Text>
            <Text style={styles.subtext}>Bugünkü çalışma planına göz at.</Text>
          </View>
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.7}
          >
            <FontAwesome name="plus" size={16} color="#004225" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chronometer */}
      <StudyTimer onSessionSaved={() => {
        refetchSummary();
        refetchPlan();
        refetchDaily();
        refetchWeekly();
      }} />

      {/* Stats Summary */}
      {summary && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FontAwesome name="bolt" size={14} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Bugünün İlerlemesi</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/preferences')}>
              <FontAwesome name="cog" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          <View style={styles.statsRow}>
            {/* Today minutes */}
            <View style={[styles.statCard, styles.statCardStudy]}>
              <View style={styles.statIconWrap}>
                <FontAwesome name="clock-o" size={14} color="#004225" />
              </View>
              <Text style={styles.statValue}>{summary.today_minutes}</Text>
              <Text style={styles.statLabel}>
                {summary.today_target_minutes
                  ? `/ ${summary.today_target_minutes} dk`
                  : 'dk bugün'}
              </Text>
              {summary.today_target_minutes != null && summary.today_target_minutes > 0 && (
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min((summary.today_minutes / summary.today_target_minutes) * 100, 100)}%` },
                    ]}
                  />
                </View>
              )}
            </View>
            {/* Streak */}
            <View style={[styles.statCard, styles.statCardStreak]}>
              <View style={styles.statIconWrap}>
                <FontAwesome name="fire" size={14} color="#f59e0b" />
              </View>
              <Text style={[styles.statValue, styles.streakValue]}>{summary.streak_days}</Text>
              <Text style={styles.statLabel}>gün seri</Text>
            </View>
            {/* Exam countdown */}
            {summary.exam_countdown_days != null && (
              <View style={[styles.statCard, styles.statCardExam]}>
                <View style={styles.statIconWrap}>
                  <FontAwesome name="graduation-cap" size={12} color="#ef4444" />
                </View>
                <Text style={[styles.statValue, styles.examValue]}>{summary.exam_countdown_days}</Text>
                <Text style={styles.statLabel}>gün sınava</Text>
              </View>
            )}
          </View>
          {/* Week summary line */}
          <View style={styles.weekSummary}>
            <FontAwesome name="calendar-o" size={12} color="#6b7280" />
            <Text style={styles.weekSummaryText}>
              Bu hafta: {summary.week_minutes} dk
              {summary.week_target_minutes != null ? ` / ${summary.week_target_minutes} dk hedef` : ''}
            </Text>
          </View>
          {/* Motivation insight */}
          <View style={styles.insightRow}>
            <FontAwesome name="lightbulb-o" size={14} color="#15803d" />
            <Text style={styles.insightText}>
              {summary.today_minutes === 0
                ? 'Serini korumak için 10 dakikayla başla.'
                : summary.today_target_minutes != null && summary.today_minutes < summary.today_target_minutes
                  ? `Bugünkü hedefinize ${summary.today_target_minutes - summary.today_minutes} dakika kaldı.`
                  : summary.today_target_minutes != null
                    ? 'Hedef tamamlandı! Harika\u2014kısa bir tekrar yapabilirsin.'
                    : `Bugün ${summary.today_minutes} dk kaydedildi. Devam et!`}
            </Text>
          </View>
        </View>
      )}

      {/* Weekly Chart */}
      {weeklyData && weeklyData.length > 0 && (
        <View style={styles.section}>
          <WeeklyChart data={weeklyData} />
        </View>
      )}

      {/* Daily Mini Chart */}
      {dailyData && dailyData.length > 0 && (
        <View style={styles.section}>
          <DailyMiniChart data={dailyData} />
        </View>
      )}

      {/* Coach Message */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow2}>
          <FontAwesome name="comment" size={13} color="#3b82f6" />
          <Text style={styles.sectionTitle}>Son Koç Mesajı</Text>
        </View>
        {loadingMessage && <ActivityIndicator style={{ marginTop: 20 }} />}
        {message && <CoachCard message={message} />}
        {!message && !loadingMessage && (
          <View style={styles.emptyCard}>
            <FontAwesome name="envelope-open-o" size={24} color="#d1d5db" />
            <Text style={styles.emptyText}>Henüz mesaj yok. Çalışmaya devam!</Text>
          </View>
        )}
      </View>

      {/* Today's Plan */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow2}>
          <FontAwesome name="check-square-o" size={14} color="#10b981" />
          <Text style={styles.sectionTitle}>Bugünün Planı</Text>
        </View>
        {loadingPlan && <ActivityIndicator style={{ marginTop: 20 }} />}
        {!loadingPlan && (
          <PlanList
            tasks={plan?.tasks || []}
            currentDate={toLocalDateStr(new Date())}
            onComplete={(id) => completeTaskMut.mutate(id)}
            onDelete={(id) => deleteTaskMut.mutate(id)}
            onUpdateTask={(id, data) => updateTaskMut.mutate({ id, data })}
            onAddTask={(data) => createTaskMut.mutate(data)}
          />
        )}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>

    {/* Add Session Modal */}
    <Modal visible={showAddModal} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalSheet}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAddModal(false); setMinutes(''); setNotes(''); setSelectedSubject(TUS_SUBJECTS[0]); }}>
              <Text style={styles.modalCancel}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Çalışma Ekle</Text>
            <TouchableOpacity onPress={handleAddSession} disabled={createSessionMutation.isPending}>
              <Text style={[styles.modalSave, createSessionMutation.isPending && { opacity: 0.5 }]}>
                Kaydet
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Subject Picker */}
            <Text style={styles.formLabel}>Ders</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {TUS_SUBJECTS.map((sub) => {
                const isActive = selectedSubject === sub;
                const color = SUBJECT_COLORS[sub] || '#004225';
                return (
                  <TouchableOpacity
                    key={sub}
                    style={[
                      styles.subjectChip,
                      isActive && { backgroundColor: color },
                    ]}
                    onPress={() => setSelectedSubject(sub)}
                  >
                    {!isActive && (
                      <View style={[styles.chipDot, { backgroundColor: color }]} />
                    )}
                    <Text style={[styles.subjectChipText, isActive && { color: '#fff' }]}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Minutes */}
            <Text style={styles.formLabel}>Süre (dakika)</Text>
            <TextInput
              placeholder="Çalışılan dakika"
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor="#9ca3af"
            />

            {/* Notes */}
            <Text style={styles.formLabel}>Notlar (isteğe bağlı)</Text>
            <TextInput
              placeholder="Ne çalıştınız?"
              value={notes}
              onChangeText={setNotes}
              multiline
              style={[styles.input, styles.textArea]}
              placeholderTextColor="#9ca3af"
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8'
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#004225',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAddBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    marginTop: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  emptyCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 28,
    borderRadius: 14,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardStudy: {
    backgroundColor: '#f0fdf4',
  },
  statCardStreak: {
    backgroundColor: '#fffbeb',
  },
  statCardExam: {
    backgroundColor: '#fef2f2',
  },
  statIconWrap: {
    marginBottom: 6,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#004225',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'center',
  },
  streakValue: {
    color: '#f59e0b',
  },
  examValue: {
    color: '#ef4444',
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#d1fae5',
    borderRadius: 2,
    marginTop: 8,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#004225',
    borderRadius: 2,
  },
  weekSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  weekSummaryText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f0fdf4',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#15803d',
    lineHeight: 18,
    fontWeight: '500',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalCancel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '700',
    color: '#004225',
  },
  modalBody: {
    padding: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    color: '#111',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjectChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
});
