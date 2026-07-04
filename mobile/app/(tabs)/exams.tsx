import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import {
  fetchExams,
  createExam,
  deleteExam,
  MockExam,
  BreakdownInput,
} from '../../src/api/exams';
import { TUS_SUBJECTS, SUBJECT_COLORS, TUSSubject } from '../../src/constants/subjects';
import { colors, shadows, typography } from '../../src/ui/theme';

export default function ExamsScreen() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const emptyBreakdowns = (): Record<string, { correct: string; wrong: string; blank: string }> => {
    const obj: Record<string, { correct: string; wrong: string; blank: string }> = {};
    for (const sub of TUS_SUBJECTS) {
      obj[sub] = { correct: '', wrong: '', blank: '' };
    }
    return obj;
  };
  const [formBreakdowns, setFormBreakdowns] = useState(emptyBreakdowns());

  const {
    data: exams = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['exams'],
    queryFn: () => fetchExams(30),
  });

  const createMutation = useMutation({
    mutationFn: createExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setIsAdding(false);
      resetForm();
      Alert.alert('Başarılı', 'Deneme sınavı kaydedildi!');
    },
    onError: (err: any) => {
      Alert.alert('Hata', err.response?.data?.detail || 'Sınav kaydedilemedi');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });

  function resetForm() {
    setFormName('');
    setFormNotes('');
    setFormBreakdowns(emptyBreakdowns());
  }

  function updateBreakdown(sub: string, field: 'correct' | 'wrong' | 'blank', val: string) {
    setFormBreakdowns((prev) => ({
      ...prev,
      [sub]: { ...prev[sub], [field]: val },
    }));
  }

  // Compute net for form preview
  const formNet = useMemo(() => {
    let net = 0;
    for (const sub of TUS_SUBJECTS) {
      const c = parseInt(formBreakdowns[sub].correct, 10) || 0;
      const w = parseInt(formBreakdowns[sub].wrong, 10) || 0;
      net += c - w * 0.25;
    }
    return Math.round(net * 100) / 100;
  }, [formBreakdowns]);

  function handleSubmit() {
    if (!formName.trim()) {
      Alert.alert('Hata', 'Lütfen sınav adını girin');
      return;
    }
    const breakdowns: BreakdownInput[] = [];
    for (const sub of TUS_SUBJECTS) {
      const c = parseInt(formBreakdowns[sub].correct, 10) || 0;
      const w = parseInt(formBreakdowns[sub].wrong, 10) || 0;
      const b = parseInt(formBreakdowns[sub].blank, 10) || 0;
      breakdowns.push({ subject: sub, correct: c, wrong: w, blank: b });
    }
    createMutation.mutate({
      exam_name: formName.trim(),
      date: new Date().toISOString().split('T')[0],
      notes: formNotes.trim() || undefined,
      breakdowns,
    });
  }

  function handleDelete(id: number) {
    Alert.alert('Sınavı Sil', 'Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }

  // Stats
  const avgScore =
    exams.length > 0
      ? exams.reduce((s, e) => s + (e.total_score || 0), 0) / exams.length
      : 0;

  // Chart data (oldest to newest, last 8)
  const chartExams = [...exams].reverse().slice(-8);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Sınav Sonuçları</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{exams.length}</Text>
            <Text style={styles.statLabel}>Toplam Sınav</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: avgScore >= 50 ? colors.success : colors.danger }]}>
              {avgScore.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>Ort. Net</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* Performance Chart */}
        {chartExams.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Performans Trendi</Text>
            <NetScoreChart exams={chartExams} />
          </View>
        )}

        {/* Exam List */}
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary[500]} />
        ) : exams.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="line-chart" size={48} color={colors.gray[300]} />
            <Text style={styles.emptyText}>Henüz sınav sonucu yok</Text>
            <Text style={styles.emptyHint}>İlk deneme sınavınızı eklemek için + tuşuna basın</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {exams.map((exam) => {
              const isExpanded = expandedId === exam.id;
              return (
                <View key={exam.id} style={styles.examCard}>
                  <TouchableOpacity
                    onPress={() => setExpandedId(isExpanded ? null : exam.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.examHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.examName}>{exam.exam_name || 'Deneme Sınavı'}</Text>
                        <Text style={styles.examDate}>
                          {new Date(exam.date + 'T00:00:00').toLocaleDateString('tr-TR', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <View style={styles.examScoreBadge}>
                        <Text style={styles.examScoreText}>
                          {exam.total_score?.toFixed(1) ?? '-'}
                        </Text>
                        <Text style={styles.examScoreLabel}>net</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDelete(exam.id)}
                        style={{ padding: 6, marginLeft: 8 }}
                      >
                        <FontAwesome name="trash-o" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Breakdown */}
                  {isExpanded && exam.breakdowns.length > 0 && (
                    <View style={styles.breakdownSection}>
                      <View style={styles.breakdownHeader}>
                        <Text style={[styles.bCol, { flex: 2 }]}>Ders</Text>
                        <Text style={styles.bCol}>D</Text>
                        <Text style={styles.bCol}>Y</Text>
                        <Text style={styles.bCol}>B</Text>
                        <Text style={styles.bCol}>Net</Text>
                      </View>
                      {exam.breakdowns.map((b) => {
                        const color = b.subject
                          ? SUBJECT_COLORS[b.subject as TUSSubject] || colors.gray[500]
                          : colors.gray[500];
                        return (
                          <View key={b.id} style={styles.breakdownRow}>
                            <View style={[styles.bCol, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                              <View style={[styles.bDot, { backgroundColor: color }]} />
                              <Text style={styles.bText} numberOfLines={1}>
                                {b.subject || '-'}
                              </Text>
                            </View>
                            <Text style={[styles.bCol, styles.bNum]}>{b.correct}</Text>
                            <Text style={[styles.bCol, styles.bNum, { color: colors.danger }]}>
                              {b.wrong}
                            </Text>
                            <Text style={[styles.bCol, styles.bNum, { color: colors.gray[400] }]}>
                              {b.blank}
                            </Text>
                            <Text
                              style={[
                                styles.bCol,
                                styles.bNum,
                                { fontWeight: '700', color: b.net >= 0 ? colors.success : colors.danger },
                              ]}
                            >
                              {b.net.toFixed(1)}
                            </Text>
                          </View>
                        );
                      })}
                      {exam.notes ? (
                        <Text style={styles.examNotes}>{exam.notes}</Text>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setIsAdding(true)} activeOpacity={0.8}>
        <FontAwesome name="plus" size={22} color={colors.white} />
      </TouchableOpacity>

      {/* Add Exam Modal */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setIsAdding(false); resetForm(); }}>
                <Text style={styles.modalCancel}>İptal</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Yeni Deneme Sınavı</Text>
              <TouchableOpacity onPress={handleSubmit} disabled={createMutation.isPending}>
                <Text style={[styles.modalSave, createMutation.isPending && { opacity: 0.5 }]}>
                  Kaydet
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Sınav Adı</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Deneme 1"
              />

              <Text style={styles.formLabel}>Ders Bazında Puanlar</Text>
              {/* Table header */}
              <View style={styles.bTableHeader}>
                <Text style={[styles.bThText, { flex: 2 }]}>Ders</Text>
                <Text style={styles.bThText}>Doğru</Text>
                <Text style={styles.bThText}>Yanlış</Text>
                <Text style={styles.bThText}>Boş</Text>
              </View>

              {TUS_SUBJECTS.map((sub) => (
                <View key={sub} style={styles.bInputRow}>
                  <Text style={[styles.bInputLabel, { flex: 2 }]} numberOfLines={1}>
                    {sub}
                  </Text>
                  <TextInput
                    style={styles.bInput}
                    value={formBreakdowns[sub].correct}
                    onChangeText={(v) => updateBreakdown(sub, 'correct', v)}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                  <TextInput
                    style={styles.bInput}
                    value={formBreakdowns[sub].wrong}
                    onChangeText={(v) => updateBreakdown(sub, 'wrong', v)}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                  <TextInput
                    style={styles.bInput}
                    value={formBreakdowns[sub].blank}
                    onChangeText={(v) => updateBreakdown(sub, 'blank', v)}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                </View>
              ))}

              {/* Net score preview */}
              <View style={styles.netPreview}>
                <Text style={styles.netLabel}>Toplam Net Puan</Text>
                <Text
                  style={[styles.netValue, { color: formNet >= 0 ? colors.success : colors.danger }]}
                >
                  {formNet.toFixed(2)}
                </Text>
              </View>

              <Text style={styles.formLabel}>Notlar (isteğe bağlı)</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={formNotes}
                onChangeText={setFormNotes}
                multiline
                placeholder="Bu sınav hakkında notlar..."
              />
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* Simple SVG line chart for net scores */
function NetScoreChart({ exams }: { exams: MockExam[] }) {
  const W = 320;
  const H = 140;
  const PAD = { top: 20, right: 16, bottom: 24, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const scores = exams.map((e) => e.total_score ?? 0);
  const minS = Math.min(...scores, 0);
  const maxS = Math.max(...scores, 1);
  const range = maxS - minS || 1;

  const points = scores.map((s, i) => ({
    x: PAD.left + (i / Math.max(scores.length - 1, 1)) * chartW,
    y: PAD.top + chartH - ((s - minS) / range) * chartH,
  }));

  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <Svg width={W} height={H}>
        {/* Y axis labels */}
        <SvgText x={PAD.left - 4} y={PAD.top + 4} fontSize={10} fill={colors.gray[400]} textAnchor="end">
          {maxS.toFixed(0)}
        </SvgText>
        <SvgText x={PAD.left - 4} y={PAD.top + chartH + 4} fontSize={10} fill={colors.gray[400]} textAnchor="end">
          {minS.toFixed(0)}
        </SvgText>

        {/* Lines */}
        {points.map((p, i) =>
          i > 0 ? (
            <Line
              key={i}
              x1={points[i - 1].x}
              y1={points[i - 1].y}
              x2={p.x}
              y2={p.y}
              stroke={colors.primary[500]}
              strokeWidth={2}
            />
          ) : null,
        )}

        {/* Dots + labels */}
        {points.map((p, i) => (
          <Circle key={`d${i}`} cx={p.x} cy={p.y} r={4} fill={colors.primary[500]} />
        ))}

        {/* X axis labels */}
        {exams.map((e, i) => (
          <SvgText
            key={`x${i}`}
            x={points[i].x}
            y={H - 4}
            fontSize={9}
            fill={colors.gray[400]}
            textAnchor="middle"
          >
            {(e.exam_name || '').substring(0, 6)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[100] },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.gray[900] },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: 'bold', color: colors.primary[500] },
  statLabel: { fontSize: 11, color: colors.gray[500], marginTop: 2 },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.gray[900], marginBottom: 4 },

  // Chart
  chartCard: {
    backgroundColor: colors.white,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Exam cards
  examCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  examHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  examName: { fontSize: 16, fontWeight: '600', color: colors.gray[900] },
  examDate: { fontSize: 12, color: colors.gray[500], marginTop: 2 },
  examScoreBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  examScoreText: { fontSize: 18, fontWeight: 'bold', color: colors.primary[500] },
  examScoreLabel: { fontSize: 10, color: colors.gray[500] },

  // Breakdown
  breakdownSection: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  breakdownHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  bCol: { flex: 1, fontSize: 12, textAlign: 'center', color: colors.gray[500] },
  bDot: { width: 8, height: 8, borderRadius: 4 },
  bText: { fontSize: 12, color: colors.gray[700], flexShrink: 1 },
  bNum: { fontSize: 13 },
  examNotes: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
  },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.gray[400], marginTop: 12 },
  emptyHint: { fontSize: 13, color: colors.gray[300], marginTop: 4 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white,
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
    borderBottomColor: colors.gray[200],
  },
  modalCancel: { fontSize: 16, color: colors.primary[500] },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.gray[900] },
  modalSave: { fontSize: 16, fontWeight: '600', color: colors.primary[500] },
  modalBody: { padding: 20 },
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

  // Breakdown input table
  bTableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    marginBottom: 4,
  },
  bThText: { flex: 1, fontSize: 11, fontWeight: '600', color: colors.gray[400], textAlign: 'center' },
  bInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  bInputLabel: { fontSize: 12, color: colors.gray[700] },
  bInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    textAlign: 'center',
  },
  netPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 14,
    borderRadius: 12,
    marginVertical: 16,
  },
  netLabel: { fontSize: 14, fontWeight: '600', color: colors.gray[700] },
  netValue: { fontSize: 22, fontWeight: 'bold' },
});
