import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDailyPlan, fetchPlanOverview, fetchPlanStructure,
  generatePlan, completeTask, updatePlanTask, deletePlanTask, createPlanTask,
  updatePreferences, reorderPlanBlocks, type DailyPlan,
} from '../../src/api/coach';
import type { UpdateTaskData, CreateTaskData, BlockConfigItem } from '../../src/api/coach';
import { usePlanGeneratorStore } from '../../src/state/planGeneratorStore';
import { ModeSelector } from '../../src/components/plan-generator/ModeSelector';
import { WizardFlow } from '../../src/components/plan-generator/WizardFlow';
import { BuilderFlow } from '../../src/components/plan-generator/BuilderFlow';
import { PlanDashboard } from '../../src/components/plan-dashboard/PlanDashboard';
import { colors, typography, radius, shadows, useThemeColors } from '../../src/ui/theme';

const toLocalDateStr = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function PlanPage() {
  const queryClient = useQueryClient();
  const c = useThemeColors();
  const generatorStore = usePlanGeneratorStore();
  const generatorMode = generatorStore.mode;
  const resetGenerator = generatorStore.reset;

  const [selectedDate, setSelectedDate] = useState(() => toLocalDateStr(new Date()));
  const [showGenerator, setShowGenerator] = useState(false);

  // ─── Queries ───────────────────────────────────────────────
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['plan-overview'],
    queryFn: fetchPlanOverview,
  });

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['plan', selectedDate],
    queryFn: () => fetchDailyPlan(selectedDate),
  });

  const { data: structure } = useQuery({
    queryKey: ['plan-structure'],
    queryFn: fetchPlanStructure,
    enabled: !!overview?.id,
  });

  // ─── Mutations ─────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async ({ turNumber, customBlockConfig }: { turNumber: number; customBlockConfig?: BlockConfigItem[] }) => {
      // 1. Save user preferences (exam date, daily hours) to backend
      const prefsUpdate: Record<string, any> = {};
      if (generatorStore.examDate) {
        prefsUpdate.exam_date = generatorStore.examDate.toISOString().split('T')[0];
      }
      if (generatorStore.mode === 'builder') {
        prefsUpdate.daily_target_minutes_weekday = Math.round(generatorStore.weekdayHours * 60);
        prefsUpdate.daily_target_minutes_weekend = Math.round(generatorStore.weekendHours * 60);
      }
      if (Object.keys(prefsUpdate).length > 0) {
        await updatePreferences(prefsUpdate).catch(() => {}); // best-effort
      }

      // 2. Generate the plan. When the builder sends a custom block config, the
      //    subject order + per-subject depth are baked in, so no separate reorder.
      const result = await generatePlan(turNumber, customBlockConfig);

      // 3. Apply custom subject order (only needed when NOT sending a full config)
      if (generatorStore.mode === 'builder' && !customBlockConfig) {
        const defaultOrder = ['Fizyoloji-Histoloji', 'Patoloji', 'Dahiliye', 'Biyokimya', 'Pediatri', 'Anatomi', 'Genel Cerrahi', 'Kadın Doğum', 'Küçük Stajlar', 'Mikrobiyoloji', 'Farmakoloji'];
        const customOrder = generatorStore.subjectOrder;
        const orderChanged = customOrder.some((s, i) => s !== defaultOrder[i]);
        if (orderChanged) {
          await reorderPlanBlocks(customOrder).catch(() => {});
        }
      }

      // 4. Clear tasks on excluded dates (shift days, holidays)
      const excluded = generatorStore.excludedDates;
      if (excluded.length > 0) {
        const planStart = result.start_date;
        const planEnd = result.end_date;
        // Only process dates within the plan range
        const relevantDates = excluded.filter((d) => d >= planStart && d <= planEnd);
        // Fetch and delete tasks for each excluded date (parallel, best-effort)
        await Promise.all(
          relevantDates.map(async (date) => {
            try {
              const dayPlan: DailyPlan = await fetchDailyPlan(date);
              await Promise.all(
                dayPlan.tasks.map((task) => deletePlanTask(task.id).catch(() => {}))
              );
            } catch {} // skip if fetch fails
          })
        );
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['plan-structure'] });
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      queryClient.invalidateQueries({ queryKey: ['stats-summary'] });
      resetGenerator();
      setShowGenerator(false);
      Alert.alert('Başarılı', 'Çalışma planınız oluşturuldu!');
    },
    onError: (err: any) => {
      Alert.alert('Hata', err.response?.data?.detail || 'Plan oluşturulamadı');
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskData }) => updatePlanTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: CreateTaskData) => createPlanTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
    },
    onError: (err: any) => Alert.alert('Hata', err.response?.data?.detail || 'Görev oluşturulamadı'),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlanTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['plan-overview'] });
    },
  });

  const hasPlan = overview && overview.id != null;

  const handleRegenerate = () => {
    Alert.alert(
      'Planı Yenile',
      'Mevcut plan arşivlenecek ve yeni plan oluşturulacak. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Yenile', onPress: () => { resetGenerator(); setShowGenerator(true); } },
      ],
    );
  };

  const handleGenerate = (turNumber: number, customBlockConfig?: BlockConfigItem[]) => {
    if (hasPlan) {
      Alert.alert(
        'Plan Oluştur',
        'Mevcut plan arşivlenecek. Devam etmek istiyor musunuz?',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Oluştur', onPress: () => generateMutation.mutate({ turNumber, customBlockConfig }) },
        ],
      );
    } else {
      generateMutation.mutate({ turNumber, customBlockConfig });
    }
  };

  // ─── Loading state ─────────────────────────────────────────
  if (overviewLoading && !hasPlan) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.surface.main }]} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={c.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Wizard mode (no plan or regenerating) ──────────────────
  if ((!hasPlan || showGenerator) && generatorMode === 'wizard') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.surface.main }]} edges={['top']}>
        <WizardFlow onGenerate={handleGenerate} isGenerating={generateMutation.isPending} />
      </SafeAreaView>
    );
  }

  // ─── Builder mode (no plan or regenerating) ─────────────────
  if ((!hasPlan || showGenerator) && generatorMode === 'builder') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.surface.main }]} edges={['top']}>
        <BuilderFlow onGenerate={handleGenerate} isGenerating={generateMutation.isPending} />
      </SafeAreaView>
    );
  }

  // ─── No plan or regenerating + No mode selected ─────────────
  if (!hasPlan || showGenerator) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.surface.main }]} edges={['top']}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={[styles.avatar, { backgroundColor: c.primary.container }]}>
              <MaterialIcons name="person" size={18} color={c.primary.onContainer} />
            </View>
            <Text style={[styles.appTitle, { color: c.primary.main }]}>TusCoach App</Text>
          </View>
        </View>
        <ModeSelector />
      </SafeAreaView>
    );
  }

  // ─── Has plan → Dashboard ──────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.surface.main }]} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={[styles.avatar, { backgroundColor: c.primary.container }]}>
            <MaterialIcons name="person" size={18} color={c.primary.onContainer} />
          </View>
          <Text style={[styles.appTitle, { color: c.primary.main }]}>TusCoach App</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {overview?.tur_number && (
            <View style={[styles.turBadge, { backgroundColor: c.primary.container }]}>
              <Text style={[styles.turBadgeText, { color: c.primary.onContainer }]}>{overview.tur_number}. Tur</Text>
            </View>
          )}
        </View>
      </View>

      <PlanDashboard
        overview={overview}
        structure={structure}
        dailyTasks={dailyData?.tasks || []}
        selectedDate={selectedDate}
        onChangeDate={setSelectedDate}
        onCompleteTask={(id) => completeMutation.mutate(id)}
        onDeleteTask={(id) => deleteMutation.mutate(id)}
        onUpdateTask={(id, data) => updateMutation.mutate({ id, data })}
        onAddTask={(data) => createTaskMutation.mutate(data)}
        onRegenerate={handleRegenerate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  appTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  turBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  turBadgeText: { ...typography.tiny, fontWeight: '700', letterSpacing: 0.5 },
});
