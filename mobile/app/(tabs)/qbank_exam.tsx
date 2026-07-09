import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColors } from '../../src/ui/theme';
import {
  startQBankExam,
  submitQBankExam,
  getQBankExam,
  getQuestion,
  QBankExamResult,
  Question,
} from '../../src/api/qbank';

const EXAM_DURATION_SECS = 135 * 60; // 135 minutes

type ExamPhase = 'starting' | 'answering' | 'submitted';

export default function QBankExamScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { test_type } = useLocalSearchParams<{ test_type?: string }>();
  const trackType = (test_type === 'klinik' ? 'klinik' : 'temel') as 'temel' | 'klinik';

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<ExamPhase>('starting');
  const [result, setResult] = useState<QBankExamResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_DURATION_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start exam session
  const startMutation = useMutation({
    mutationFn: () => startQBankExam(trackType),
    onSuccess: async (session) => {
      setSessionId(session.id);
      setQuestionIds(session.question_ids);
      setPhase('answering');
      // Fetch all questions in parallel (batch of 10 for perf)
      const qMap: Record<string, Question> = {};
      await Promise.all(
        session.question_ids.map(async (id) => {
          try {
            const q = await getQuestion(id);
            qMap[id] = q;
          } catch (_) {}
        }),
      );
      setQuestions(qMap);
    },
    onError: () => {
      Alert.alert('Hata', 'Sınav başlatılamadı. Yeterli soru bulunamadı.');
    },
  });

  // Submit exam
  const submitMutation = useMutation({
    mutationFn: () => submitQBankExam(sessionId!, answers),
    onSuccess: (res) => {
      setResult(res);
      setPhase('submitted');
      if (timerRef.current) clearInterval(timerRef.current);
    },
    onError: () => {
      Alert.alert('Hata', 'Sınav gönderilemedi.');
    },
  });

  // Timer
  useEffect(() => {
    if (phase !== 'answering') return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          submitMutation.mutate();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    startMutation.mutate();
  }, []);

  const handleAnswer = useCallback((key: string) => {
    if (!questionIds[currentIndex]) return;
    setAnswers((prev) => ({ ...prev, [questionIds[currentIndex]]: key }));
  }, [currentIndex, questionIds]);

  const handleSubmit = useCallback(() => {
    Alert.alert(
      'Sınavı Bitir',
      'Sınavı bitirmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Bitir', style: 'destructive', onPress: () => submitMutation.mutate() },
      ],
    );
  }, [submitMutation]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const timerColor =
    secondsLeft < 5 * 60 ? '#C62828' : secondsLeft < 10 * 60 ? '#E65100' : c.onSurface.main;

  const s = styles(c);

  // ── Starting ──────────────────────────────────────────────────────────────
  if (phase === 'starting' || startMutation.isPending) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={c.primary.main} />
        <Text style={[s.subtitle, { marginTop: 12 }]}>Sınav hazırlanıyor…</Text>
      </SafeAreaView>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (phase === 'submitted' && result) {
    const subjects = Object.entries(result.by_subject).sort(([a], [b]) => a.localeCompare(b));
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={c.onSurface.main} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Sınav Sonuçları</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={s.resultCard}>
            <Text style={s.scoreText}>{result.score_pct.toFixed(1)}%</Text>
            <Text style={s.subtitle}>{result.correct} / {result.total} doğru</Text>
            <Text style={[s.subtitle, { marginTop: 4 }]}>
              {trackType.toUpperCase()} sınavı
            </Text>
          </View>

          <Text style={s.sectionTitle}>Konulara Göre</Text>
          {subjects.map(([subject, data]) => {
            const rate = data.total > 0 ? data.correct / data.total : 0;
            const barColor = rate >= 0.8 ? '#2E7D32' : rate >= 0.5 ? '#E65100' : '#C62828';
            return (
              <View key={subject} style={s.subjectRow}>
                <Text style={s.subjectName}>{subject}</Text>
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${rate * 100}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={[s.subjectRate, { color: barColor }]}>
                  {data.correct}/{data.total}
                </Text>
              </View>
            );
          })}

          <TouchableOpacity style={s.primaryBtn} onPress={() => router.back()}>
            <Text style={s.primaryBtnText}>Kapat</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Exam ──────────────────────────────────────────────────────────────────
  const currentId = questionIds[currentIndex];
  const currentQuestion = questions[currentId];
  const answeredCount = Object.keys(answers).length;

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.timer, { color: timerColor }]}>{formatTime(secondsLeft)}</Text>
        <Text style={s.progress}>
          {currentIndex + 1} / {questionIds.length}
        </Text>
        <TouchableOpacity onPress={handleSubmit} style={s.submitBtn}>
          <Text style={s.submitBtnText}>Bitir</Text>
        </TouchableOpacity>
      </View>

      {/* Question navigator dots */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dotScroll}>
        {questionIds.map((id, i) => (
          <TouchableOpacity key={id} onPress={() => setCurrentIndex(i)} style={{ padding: 3 }}>
            <View
              style={[
                s.dot,
                answers[id] ? s.dotAnswered : s.dotUnanswered,
                i === currentIndex && s.dotCurrent,
              ]}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Question */}
      {!currentQuestion ? (
        <View style={s.center}>
          <ActivityIndicator color={c.primary.main} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: '#1B3A6B22' }]}>
              <Text style={[s.badgeText, { color: '#1B3A6B' }]}>
                {currentQuestion.test?.toUpperCase()}
              </Text>
            </View>
            <Text style={s.subject}>{currentQuestion.subject}</Text>
          </View>

          <Text style={s.stem}>{currentQuestion.stem}</Text>

          {Object.keys(currentQuestion.options).sort().map((key) => {
            const isSelected = answers[currentId] === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.option, isSelected && s.optionSelected]}
                onPress={() => handleAnswer(key)}
                activeOpacity={0.75}
              >
                <Text style={s.optionKey}>{key}</Text>
                <Text style={s.optionText}>{currentQuestion.options[key]}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Prev / Next */}
          <View style={s.navRow}>
            <TouchableOpacity
              style={[s.navBtn, currentIndex === 0 && s.navBtnDisabled]}
              onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              <MaterialIcons name="chevron-left" size={22} color={currentIndex === 0 ? c.outline.main : c.primary.main} />
              <Text style={[s.navBtnText, currentIndex === 0 && { color: c.outline.main }]}>Önceki</Text>
            </TouchableOpacity>

            <Text style={s.answeredCount}>{answeredCount} cevaplanmış</Text>

            <TouchableOpacity
              style={[s.navBtn, currentIndex >= questionIds.length - 1 && s.navBtnDisabled]}
              onPress={() => setCurrentIndex((i) => Math.min(questionIds.length - 1, i + 1))}
              disabled={currentIndex >= questionIds.length - 1}
            >
              <Text style={[s.navBtnText, currentIndex >= questionIds.length - 1 && { color: c.outline.main }]}>Sonraki</Text>
              <MaterialIcons name="chevron-right" size={22} color={currentIndex >= questionIds.length - 1 ? c.outline.main : c.primary.main} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface.main },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: c.surface.main },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.surface.containerHighest,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.onSurface.main },
    timer: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
    progress: { fontSize: 14, fontWeight: '600', color: c.onSurface.variant },
    submitBtn: { backgroundColor: '#C62828', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    submitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    dotScroll: { maxHeight: 40, paddingHorizontal: 12, paddingVertical: 6 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    dotAnswered: { backgroundColor: c.primary.main },
    dotUnanswered: { backgroundColor: c.surface.containerHighest, borderWidth: 1, borderColor: c.outline.main },
    dotCurrent: { transform: [{ scale: 1.4 }] },
    badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    subject: { fontSize: 13, color: c.onSurface.variant, fontWeight: '500' },
    scroll: { paddingHorizontal: 16, paddingTop: 12 },
    stem: { fontSize: 15, lineHeight: 22, color: c.onSurface.main, marginBottom: 16, fontWeight: '500' },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: c.surface.container,
      borderRadius: 12,
      padding: 12,
      marginBottom: 9,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    optionSelected: { borderColor: c.primary.main, backgroundColor: c.primary.fixed + '33' },
    optionKey: { fontSize: 14, fontWeight: '700', color: c.primary.main, width: 20 },
    optionText: { flex: 1, fontSize: 13, lineHeight: 19, color: c.onSurface.main },
    navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
    navBtnDisabled: { opacity: 0.4 },
    navBtnText: { fontSize: 14, fontWeight: '600', color: c.primary.main },
    answeredCount: { fontSize: 13, color: c.onSurface.variant },
    // Results
    resultCard: {
      backgroundColor: c.surface.container,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 24,
    },
    scoreText: { fontSize: 52, fontWeight: '800', color: c.primary.main },
    subtitle: { fontSize: 15, color: c.onSurface.variant, textAlign: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.onSurface.main, marginBottom: 12 },
    subjectRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    subjectName: { width: 120, fontSize: 13, color: c.onSurface.main },
    barBg: { flex: 1, height: 8, backgroundColor: c.surface.containerHighest, borderRadius: 4, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 4 },
    subjectRate: { width: 40, fontSize: 12, fontWeight: '600', textAlign: 'right' },
    primaryBtn: {
      backgroundColor: c.primary.main,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 24,
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  });
