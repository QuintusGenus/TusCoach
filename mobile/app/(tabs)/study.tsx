import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchStudySessions,
  createStudySession,
  deleteStudySession,
  StudySession,
} from '../../src/api/study';
import { TUS_SUBJECTS, SUBJECT_COLORS, TUSSubject } from '../../src/constants/subjects';
import { colors, shadows, typography } from '../../src/ui/theme';

export default function StudyScreen() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string | null>(null);

  // Form state
  const [formSubject, setFormSubject] = useState<string>(TUS_SUBJECTS[0]);
  const [formMinutes, setFormMinutes] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const {
    data: sessions = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['study-sessions', filterSubject],
    queryFn: () => fetchStudySessions(90, filterSubject ?? undefined),
  });

  const createMutation = useMutation({
    mutationFn: createStudySession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['stats-summary'] });
      setIsAdding(false);
      resetForm();
      Alert.alert('Başarılı', 'Çalışma oturumu eklendi!');
    },
    onError: (err: any) => {
      Alert.alert('Hata', err.response?.data?.detail || 'Oturum eklenemedi');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStudySession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['stats-summary'] });
    },
  });

  function resetForm() {
    setFormSubject(TUS_SUBJECTS[0]);
    setFormMinutes('');
    setFormNotes('');
  }

  function handleSubmit() {
    const min = parseInt(formMinutes, 10);
    if (!formMinutes || isNaN(min) || min < 1) {
      Alert.alert('Hata', 'Lütfen geçerli dakika girin (1-1000)');
      return;
    }
    if (min > 1000) {
      Alert.alert('Hata', 'Maksimum 1000 dakika');
      return;
    }
    createMutation.mutate({
      date: new Date().toISOString().split('T')[0],
      minutes: min,
      subject: formSubject,
      notes: formNotes.trim() || undefined,
    });
  }

  function handleDelete(id: number) {
    Alert.alert('Oturumu Sil', 'Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  }

  // Group sessions by date
  const grouped = sessions.reduce<Record<string, StudySession[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Total stats
  const totalMinutes = sessions.reduce((s, x) => s + x.minutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainMinutes = totalMinutes % 60;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Bugün';
    if (dateStr === yesterday) return 'Dün';
    return d.toLocaleDateString('tr-TR', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const renderSession = useCallback(
    ({ item }: { item: StudySession }) => {
      const color = item.subject
        ? SUBJECT_COLORS[item.subject as TUSSubject] || colors.gray[500]
        : colors.gray[500];
      const isChrono = item.notes?.startsWith('Kronometre:');
      return (
        <View style={styles.sessionRow}>
          <View style={[styles.sessionDot, { backgroundColor: color }]} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sessionSubject}>{item.subject || 'Genel'}</Text>
              {isChrono && (
                <View style={styles.chronoBadge}>
                  <FontAwesome name="clock-o" size={9} color={colors.primary[500]} />
                </View>
              )}
            </View>
            {item.notes ? (
              <Text style={styles.sessionNotes} numberOfLines={isChrono ? 2 : 1}>
                {isChrono ? item.notes.replace('Kronometre: ', '') : item.notes}
              </Text>
            ) : null}
          </View>
          <Text style={styles.sessionMinutes}>{item.minutes} dk</Text>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            style={styles.deleteBtn}
          >
            <FontAwesome name="trash-o" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      );
    },
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Çalışma Oturumları</Text>
        <Text style={styles.subtitle}>
          {totalHours}s {remainMinutes}dk toplam ({sessions.length} oturum)
        </Text>
      </View>

      {/* Subject Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterPill, !filterSubject && styles.filterPillActive]}
          onPress={() => setFilterSubject(null)}
        >
          <Text
            style={[
              styles.filterPillText,
              !filterSubject && styles.filterPillTextActive,
            ]}
          >
            Tümü
          </Text>
        </TouchableOpacity>
        {TUS_SUBJECTS.map((sub) => (
          <TouchableOpacity
            key={sub}
            style={[
              styles.filterPill,
              filterSubject === sub && styles.filterPillActive,
            ]}
            onPress={() => setFilterSubject(filterSubject === sub ? null : sub)}
          >
            <Text
              style={[
                styles.filterPillText,
                filterSubject === sub && styles.filterPillTextActive,
              ]}
            >
              {sub}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sessions List */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary[500]} />
      ) : dateKeys.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="clock-o" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyText}>Henüz çalışma oturumu yok</Text>
          <Text style={styles.emptyHint}>İlk oturumunuzu eklemek için + tuşuna basın</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
        >
          {dateKeys.map((date) => (
            <View key={date} style={styles.dateGroup}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateLabel}>{formatDate(date)}</Text>
                <Text style={styles.dateTotalMin}>
                  {grouped[date].reduce((s, x) => s + x.minutes, 0)} dk
                </Text>
              </View>
              <View style={styles.dateCard}>
                {grouped[date].map((session) => (
                  <View key={session.id}>{renderSession({ item: session })}</View>
                ))}
              </View>
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsAdding(true)}
        activeOpacity={0.8}
      >
        <FontAwesome name="plus" size={22} color={colors.white} />
      </TouchableOpacity>

      {/* Add Session Modal */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setIsAdding(false); resetForm(); }}>
                <Text style={styles.modalCancel}>İptal</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Yeni Oturum</Text>
              <TouchableOpacity onPress={handleSubmit} disabled={createMutation.isPending}>
                <Text style={[styles.modalSave, createMutation.isPending && { opacity: 0.5 }]}>
                  Kaydet
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Subject Picker */}
              <Text style={styles.formLabel}>Ders</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {TUS_SUBJECTS.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    style={[
                      styles.subjectChip,
                      formSubject === sub && {
                        backgroundColor: SUBJECT_COLORS[sub] || colors.primary[500],
                      },
                    ]}
                    onPress={() => setFormSubject(sub)}
                  >
                    <Text
                      style={[
                        styles.subjectChipText,
                        formSubject === sub && { color: colors.white },
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Minutes */}
              <Text style={styles.formLabel}>Süre (dakika)</Text>
              <TextInput
                style={styles.input}
                value={formMinutes}
                onChangeText={setFormMinutes}
                keyboardType="number-pad"
                placeholder="örn. 45"
              />

              {/* Notes */}
              <Text style={styles.formLabel}>Notlar (isteğe bağlı)</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={formNotes}
                onChangeText={setFormNotes}
                multiline
                placeholder="Ne çalıştınız?"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  // Filters
  filterScroll: { maxHeight: 48, backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.background,
  },
  filterPillActive: { backgroundColor: colors.primary[500] },
  filterPillText: { fontSize: 13, fontWeight: '600', color: colors.gray[500] },
  filterPillTextActive: { color: colors.white },

  // Sessions list
  dateGroup: { marginTop: 16, paddingHorizontal: 20 },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateLabel: { fontSize: 15, fontWeight: '700', color: colors.gray[800] },
  dateTotalMin: { fontSize: 13, color: colors.gray[500] },
  dateCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: 10,
  },
  sessionDot: { width: 10, height: 10, borderRadius: 5 },
  chronoBadge: {
    backgroundColor: colors.primary[100],
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionSubject: { fontSize: 14, fontWeight: '600', color: colors.gray[900] },
  sessionNotes: { fontSize: 12, color: colors.gray[500], marginTop: 2 },
  sessionMinutes: { fontSize: 14, fontWeight: '600', color: colors.primary[500] },
  deleteBtn: { padding: 6 },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  emptyText: { fontSize: 16, color: colors.gray[400], marginTop: 12 },
  emptyHint: { fontSize: 13, color: colors.gray[300], marginTop: 4 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary[500],
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  modalCancel: { fontSize: 16, color: colors.primary[500] },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.gray[900] },
  modalSave: { fontSize: 16, fontWeight: '600', color: colors.primary[500] },
  modalBody: { padding: 20 },

  // Form
  formLabel: { fontSize: 14, fontWeight: '500', color: colors.gray[700], marginBottom: 8 },
  input: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray[200],
    fontSize: 15,
    marginBottom: 16,
  },
  subjectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.background,
    marginRight: 8,
  },
  subjectChipText: { fontSize: 13, fontWeight: '600', color: colors.gray[500] },
});
