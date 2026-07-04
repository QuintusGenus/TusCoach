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
  fetchStatsSummary,
  fetchWeeklyStats,
  fetchDailyStats,
} from '../../src/api/coach';
import { CoachCard } from '../../src/components/CoachCard';
import { PlanList } from '../../src/components/PlanList';
import { WeeklyChart } from '../../src/components/WeeklyChart';
import { DailyMiniChart } from '../../src/components/DailyMiniChart';
import { StudyTimer } from '../../src/components/StudyTimer';
import { useAuthStore } from '../../src/state/authStore';
import { TUS_SUBJECTS, SUBJECT_COLORS } from '../../src/constants/subjects';

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
    mutationFn: ({ id, minutes }: { id: number; minutes: number }) =>
      updatePlanTask(id, minutes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] }),
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

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

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

  return (
    <>
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Tekrar Hoş Geldin{user?.email ? `, ${user.email.split('@')[0]}` : ''}!</Text>
            <Text style={styles.subtext}>Koçluk güncellemeniz ve günlük planınız.</Text>
          </View>
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.7}
          >
            <FontAwesome name="plus" size={18} color="#fff" />
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
            <Text style={[styles.sectionTitle, { paddingHorizontal: 0, marginBottom: 0 }]}>Bugünün İlerlemesi</Text>
            <TouchableOpacity onPress={() => router.push('/preferences')}>
              <Text style={styles.editLink}>Ayarlar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statsRow}>
            {/* Today minutes */}
            <View style={styles.statCard}>
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
            <View style={styles.statCard}>
              <Text style={[styles.statValue, styles.streakValue]}>{summary.streak_days}</Text>
              <Text style={styles.statLabel}>gün seri</Text>
            </View>
            {/* Exam countdown */}
            {summary.exam_countdown_days != null && (
              <View style={styles.statCard}>
                <Text style={[styles.statValue, styles.examValue]}>{summary.exam_countdown_days}</Text>
                <Text style={styles.statLabel}>gün sınava</Text>
              </View>
            )}
          </View>
          {/* Week summary line */}
          <View style={styles.weekSummary}>
            <Text style={styles.weekSummaryText}>
              Bu hafta: {summary.week_minutes} dk
              {summary.week_target_minutes != null ? ` / ${summary.week_target_minutes} dk hedef` : ''}
            </Text>
          </View>
          {/* Motivation insight */}
          <View style={styles.insightRow}>
            <Text style={styles.insightText}>
              {summary.today_minutes === 0
                ? 'Serini korumak için 10 dakikayla başla.'
                : summary.today_target_minutes != null && summary.today_minutes < summary.today_target_minutes
                  ? `Bugünkü hedefinize ${summary.today_target_minutes - summary.today_minutes} dakika kaldı.`
                  : summary.today_target_minutes != null
                    ? 'Hedef tamamlandı. Harika\u2014kısa bir tekrar yapabilirsin.'
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
        <Text style={styles.sectionTitle}>Son Koç Mesajı</Text>
        {loadingMessage && <ActivityIndicator style={{ marginTop: 20 }} />}
        {message && <CoachCard message={message} />}
        {!message && !loadingMessage && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Henüz mesaj yok. Çalışmaya devam!</Text>
          </View>
        )}
      </View>

      {/* Today's Plan */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bugünün Planı</Text>
        {loadingPlan && <ActivityIndicator style={{ marginTop: 20 }} />}
        {plan?.tasks && plan.tasks.length > 0 && (
          <View style={styles.planCard}>
            <PlanList
              tasks={plan.tasks}
              onComplete={(id) => completeTaskMut.mutate(id)}
              onDelete={(id) => deleteTaskMut.mutate(id)}
              onUpdateMinutes={(id, minutes) => updateTaskMut.mutate({ id, minutes })}
            />
          </View>
        )}
        {plan?.tasks?.length === 0 && !loadingPlan && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Bugün için planlanmış görev yok.</Text>
          </View>
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
              {TUS_SUBJECTS.map((sub) => (
                <TouchableOpacity
                  key={sub}
                  style={[
                    styles.subjectChip,
                    selectedSubject === sub && { backgroundColor: SUBJECT_COLORS[sub] || '#004225' },
                  ]}
                  onPress={() => setSelectedSubject(sub)}
                >
                  <Text style={[styles.subjectChipText, selectedSubject === sub && { color: '#fff' }]}>
                    {sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Minutes */}
            <Text style={styles.formLabel}>Süre (dakika)</Text>
            <TextInput
              placeholder="Çalışılan dakika"
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              style={styles.input}
            />

            {/* Notes */}
            <Text style={styles.formLabel}>Notlar (isteğe bağlı)</Text>
            <TextInput
              placeholder="Ne çalıştınız?"
              value={notes}
              onChangeText={setNotes}
              multiline
              style={[styles.input, styles.textArea]}
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
    backgroundColor: '#f3f4f6'
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111'
  },
  subtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  section: {
    marginTop: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    paddingHorizontal: 16,
    marginBottom: 12
  },
  emptyCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center'
  },
  emptyText: {
    color: '#999',
    fontSize: 14
  },
  planCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#004225',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  input: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCancel: {
    fontSize: 16,
    color: '#004225',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#004225',
  },
  modalBody: {
    padding: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12
  },
  editLink: {
    color: '#004225',
    fontSize: 14,
    fontWeight: '600'
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
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
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginTop: 8,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#004225',
    borderRadius: 2,
  },
  weekSummary: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  weekSummaryText: {
    fontSize: 13,
    color: '#6b7280',
  },
  insightRow: {
    backgroundColor: '#f0fdf4',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
  },
  insightText: {
    fontSize: 13,
    color: '#15803d',
    lineHeight: 18,
  },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    marginRight: 6,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
});
