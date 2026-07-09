import { useState, useCallback, useEffect } from 'react';
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
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColors } from '../../src/ui/theme';
import {
  getTodayQuestions,
  getDrillQuestions,
  getSubjects,
  recordAttempt,
  Question,
  SubjectItem,
} from '../../src/api/qbank';
import { createNote } from '../../src/api/notes';

type Mode = 'landing' | 'drill-subject' | 'drill-subtopic' | 'session';
type Phase = 'loading' | 'answering' | 'revealed' | 'done' | 'empty';
type SessionSource = 'today' | 'drill';

export default function PracticeScreen() {
  const c = useThemeColors();
  const router = useRouter();

  // ─── Mode state ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('landing');
  const [sessionSource, setSessionSource] = useState<SessionSource>('today');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState<string | null>(null);

  // ─── Session state ────────────────────────────────────────────────────────
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [correctKey, setCorrectKey] = useState<string>('');
  const [explanation, setExplanation] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lastWrong, setLastWrong] = useState<{ subject: string; explanation: string } | null>(null);

  // ─── API Queries ──────────────────────────────────────────────────────────
  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ['qbank', 'subjects'],
    queryFn: getSubjects,
    enabled: mode === 'drill-subject',
  });

  const { data: todayData, isLoading: todayLoading, refetch: refetchToday } = useQuery({
    queryKey: ['qbank', 'today'],
    queryFn: getTodayQuestions,
    enabled: mode === 'session' && sessionSource === 'today',
  });

  const { data: drillData, isLoading: drillLoading, refetch: refetchDrill } = useQuery({
    queryKey: ['qbank', 'drill', selectedSubject, selectedSubtopic],
    queryFn: () => getDrillQuestions(selectedSubject!, selectedSubtopic ?? undefined, 10),
    enabled: mode === 'session' && sessionSource === 'drill' && !!selectedSubject,
  });

  useEffect(() => {
    if (!todayData || mode !== 'session' || sessionSource !== 'today') return;
    if (todayData.questions.length === 0) setPhase('empty');
    else { setQuestions(todayData.questions); setPhase('answering'); }
  }, [todayData, mode, sessionSource]);

  useEffect(() => {
    if (!drillData || mode !== 'session' || sessionSource !== 'drill') return;
    if (drillData.questions.length === 0) setPhase('empty');
    else { setQuestions(drillData.questions); setPhase('answering'); }
  }, [drillData, mode, sessionSource]);

  const isSessionLoading = (todayLoading || drillLoading) && phase === 'loading';

  // ─── Attempt mutation ─────────────────────────────────────────────────────
  const attemptMutation = useMutation({
    mutationFn: ({ question_id, selected_key }: { question_id: string; selected_key: string }) =>
      recordAttempt(question_id, selected_key),
    onSuccess: (result) => {
      setCorrectKey(result.correct_key);
      setExplanation(result.explanation);
      if (result.is_correct) {
        setCorrectCount((n) => n + 1);
        setLastWrong(null);
      } else {
        const q = questions[index];
        setLastWrong({ subject: q.subject, explanation: result.explanation ?? '' });
      }
      setPhase('revealed');
    },
    onError: () => Alert.alert('Hata', 'Cevap kaydedilemedi, tekrar deneyin.'),
  });

  // ─── Save-as-note mutation (Item 7) ────────────────────────────────────────
  const saveNoteMutation = useMutation({
    mutationFn: ({ subject, explanation }: { subject: string; explanation: string }) =>
      createNote({ title: `${subject} — Yanlış Cevap`, content: explanation, subject }),
    onSuccess: () => Alert.alert('Kaydedildi', 'Açıklama notlarınıza eklendi.'),
    onError: () => Alert.alert('Hata', 'Not kaydedilemedi.'),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const startTodaySession = useCallback(() => {
    setSessionSource('today');
    setPhase('loading');
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setMode('session');
  }, []);

  const startDrillSession = useCallback((subject: string, subtopic: string | null) => {
    setSelectedSubject(subject);
    setSelectedSubtopic(subtopic);
    setSessionSource('drill');
    setPhase('loading');
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setMode('session');
  }, []);

  const currentQuestion = questions[index];

  const handleAnswer = useCallback(
    (key: string) => {
      if (phase !== 'answering' || !currentQuestion) return;
      setSelected(key);
      attemptMutation.mutate({ question_id: currentQuestion.id, selected_key: key });
    },
    [phase, currentQuestion, attemptMutation],
  );

  const handleNext = useCallback(() => {
    if (index + 1 >= questions.length) setPhase('done');
    else { setIndex((i) => i + 1); setSelected(null); setPhase('answering'); setLastWrong(null); }
  }, [index, questions.length]);

  const handleRestart = useCallback(() => {
    if (sessionSource === 'drill') refetchDrill();
    else refetchToday();
    setPhase('loading');
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setLastWrong(null);
  }, [sessionSource, refetchDrill, refetchToday]);

  const s = styles(c);

  // ─── LANDING SCREEN ───────────────────────────────────────────────────────
  if (mode === 'landing') {
    return (
      <SafeAreaView style={s.center}>
        <MaterialIcons name="quiz" size={52} color={c.primary.main} />
        <Text style={s.title}>Pratik Modu</Text>
        <Text style={s.subtitle}>Nasıl çalışmak istiyorsun?</Text>

        <TouchableOpacity style={s.modeCard} onPress={startTodaySession} activeOpacity={0.8}>
          <MaterialIcons name="auto-awesome" size={28} color={c.primary.main} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.modeTitle}>Kişisel Antrenman</Text>
            <Text style={s.modeDesc}>
              SRS tekrarlar + adaptif yeni sorular (günlük 10 soru)
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={c.primary.main} />
        </TouchableOpacity>

        <TouchableOpacity style={s.modeCard} onPress={() => setMode('drill-subject')} activeOpacity={0.8}>
          <MaterialIcons name="school" size={28} color={c.primary.main} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.modeTitle}>Konu Çalış</Text>
            <Text style={s.modeDesc}>
              Belirli bir branş veya konu seç, o konudan soru çöz
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={c.primary.main} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ─── DRILL: SUBJECT LIST ──────────────────────────────────────────────────
  if (mode === 'drill-subject') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setMode('landing')}>
            <MaterialIcons name="arrow-back" size={24} color={c.onSurface.main} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Branş Seç</Text>
          <View style={{ width: 24 }} />
        </View>
        {subjectsLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="large" color={c.primary.main} />
        ) : (
          <FlatList
            data={subjectsData ?? []}
            keyExtractor={(item) => item.subject}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }: { item: SubjectItem }) => (
              <TouchableOpacity
                style={s.listItem}
                onPress={() => {
                  setSelectedSubject(item.subject);
                  if (item.subtopics.length > 0) setMode('drill-subtopic');
                  else startDrillSession(item.subject, null);
                }}
                activeOpacity={0.75}
              >
                <Text style={s.listItemText}>{item.subject}</Text>
                {item.subtopics.length > 0 && (
                  <Text style={s.listItemSub}>{item.subtopics.length} konu</Text>
                )}
                <MaterialIcons name="chevron-right" size={20} color={c.outline.main} />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // ─── DRILL: SUBTOPIC LIST ─────────────────────────────────────────────────
  if (mode === 'drill-subtopic') {
    const subject = subjectsData?.find((s) => s.subject === selectedSubject);
    const subtopics = subject?.subtopics ?? [];

    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setMode('drill-subject')}>
            <MaterialIcons name="arrow-back" size={24} color={c.onSurface.main} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{selectedSubject}</Text>
          <View style={{ width: 24 }} />
        </View>
        <FlatList
          data={['Tüm Konular', ...subtopics]}
          keyExtractor={(item) => item}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.listItem}
              onPress={() => startDrillSession(selectedSubject!, item === 'Tüm Konular' ? null : item)}
              activeOpacity={0.75}
            >
              <Text style={s.listItemText}>{item}</Text>
              <MaterialIcons name="chevron-right" size={20} color={c.outline.main} />
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  // ─── SESSION: STATES ──────────────────────────────────────────────────────
  if (isSessionLoading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={c.primary.main} />
        <Text style={[s.subtitle, { marginTop: 12 }]}>Sorular yükleniyor…</Text>
      </SafeAreaView>
    );
  }

  if (phase === 'empty') {
    return (
      <SafeAreaView style={s.center}>
        <MaterialIcons name="check-circle" size={56} color={c.primary.main} />
        <Text style={s.title}>Bugünlük tamamlandı!</Text>
        <Text style={s.subtitle}>
          {sessionSource === 'drill' ? 'Bu konuda yanlış sorun kalmadı.' : 'Yeni sorular yarın hazır olacak.'}
        </Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => setMode('landing')}>
          <Text style={s.primaryBtnText}>Ana Menüye Dön</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (phase === 'done') {
    const total = questions.length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <SafeAreaView style={s.center}>
        <MaterialIcons name="emoji-events" size={56} color={c.primary.main} />
        <Text style={s.title}>Oturum Tamamlandı</Text>
        <Text style={s.scoreText}>{pct}%</Text>
        <Text style={s.subtitle}>{correctCount} / {total} doğru</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={handleRestart}>
          <Text style={s.primaryBtnText}>Tekrar Başlat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: c.surface.container, marginTop: 10 }]} onPress={() => setMode('landing')}>
          <Text style={[s.primaryBtnText, { color: c.primary.main }]}>Ana Menüye Dön</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) return null;

  const optionKeys = Object.keys(currentQuestion.options).sort();

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => setMode('landing')}>
          <MaterialIcons name="arrow-back" size={24} color={c.onSurface.main} />
        </TouchableOpacity>
        <Text style={s.progress}>{index + 1} / {questions.length}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Track badge */}
      <View style={s.badgeRow}>
        <View style={[s.badge, { backgroundColor: currentQuestion.test === 'temel' ? '#1B3A6B22' : '#00445C22' }]}>
          <Text style={[s.badgeText, { color: currentQuestion.test === 'temel' ? '#1B3A6B' : '#00445C' }]}>
            {currentQuestion.test.toUpperCase()}
          </Text>
        </View>
        <Text style={s.subject}>{currentQuestion.subject}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.stem}>{currentQuestion.stem}</Text>

        {optionKeys.map((key) => {
          let optStyle = s.option;
          if (phase === 'revealed') {
            if (key === correctKey) optStyle = { ...s.option, ...s.optionCorrect };
            else if (key === selected && key !== correctKey) optStyle = { ...s.option, ...s.optionWrong };
          } else if (selected === key) {
            optStyle = { ...s.option, backgroundColor: c.surface.container };
          }
          return (
            <TouchableOpacity
              key={key}
              style={optStyle}
              onPress={() => handleAnswer(key)}
              disabled={phase !== 'answering'}
              activeOpacity={0.75}
            >
              <Text style={s.optionKey}>{key}</Text>
              <Text style={s.optionText}>{currentQuestion.options[key]}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Explanation */}
        {phase === 'revealed' && explanation && (
          <View style={[s.explanationBox, { borderLeftColor: selected === correctKey ? '#2E7D32' : '#C62828' }]}>
            <Text style={s.explanationLabel}>Açıklama</Text>
            <Text style={s.explanationText}>{explanation}</Text>
          </View>
        )}

        {/* Item 7 — Save-as-note button on wrong answers */}
        {phase === 'revealed' && lastWrong && (
          <TouchableOpacity
            style={s.noteBtn}
            onPress={() => saveNoteMutation.mutate(lastWrong)}
            disabled={saveNoteMutation.isPending}
            activeOpacity={0.8}
          >
            <MaterialIcons name="note-add" size={18} color={c.primary.main} />
            <Text style={s.noteBtnText}>
              {saveNoteMutation.isPending ? 'Kaydediliyor…' : 'Nota Ekle'}
            </Text>
          </TouchableOpacity>
        )}

        {phase === 'revealed' && (
          <TouchableOpacity style={s.primaryBtn} onPress={handleNext}>
            <Text style={s.primaryBtnText}>
              {index + 1 >= questions.length ? 'Sonuçları Gör' : 'Sonraki Soru'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    },
    headerTitle: { fontSize: 16, fontWeight: '700', color: c.onSurface.main },
    progress: { fontSize: 15, fontWeight: '600', color: c.onSurface.main },
    badgeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    subject: { fontSize: 13, color: c.onSurface.variant, fontWeight: '500' },
    scroll: { paddingHorizontal: 16, paddingTop: 4 },
    stem: { fontSize: 16, lineHeight: 24, color: c.onSurface.main, marginBottom: 20, fontWeight: '500' },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: c.surface.container,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    optionCorrect: { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' },
    optionWrong: { backgroundColor: '#FFEBEE', borderColor: '#C62828' },
    optionKey: { fontSize: 15, fontWeight: '700', color: c.primary.main, width: 20 },
    optionText: { flex: 1, fontSize: 14, lineHeight: 20, color: c.onSurface.main },
    explanationBox: {
      borderLeftWidth: 4,
      paddingLeft: 12,
      paddingVertical: 10,
      marginTop: 8,
      marginBottom: 8,
    },
    explanationLabel: { fontSize: 12, fontWeight: '700', color: c.onSurface.variant, marginBottom: 4 },
    explanationText: { fontSize: 13, lineHeight: 19, color: c.onSurface.main },
    noteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: c.surface.container,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.primary.main,
    },
    noteBtnText: { fontSize: 13, fontWeight: '600', color: c.primary.main },
    title: { fontSize: 22, fontWeight: '700', color: c.onSurface.main, marginTop: 16, textAlign: 'center' },
    subtitle: { fontSize: 15, color: c.onSurface.variant, marginTop: 8, textAlign: 'center', lineHeight: 22 },
    scoreText: { fontSize: 56, fontWeight: '800', color: c.primary.main, marginTop: 8 },
    primaryBtn: {
      backgroundColor: c.primary.main,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 16,
      width: '100%',
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    modeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface.container,
      borderRadius: 16,
      padding: 18,
      marginTop: 16,
      width: '100%',
      borderWidth: 1,
      borderColor: c.surface.containerHighest ?? c.surface.container,
    },
    modeTitle: { fontSize: 16, fontWeight: '700', color: c.onSurface.main, marginBottom: 4 },
    modeDesc: { fontSize: 13, color: c.onSurface.variant, lineHeight: 18 },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface.container,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
    },
    listItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: c.onSurface.main },
    listItemSub: { fontSize: 12, color: c.onSurface.variant, marginRight: 8 },
  });
