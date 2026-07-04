import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { PlanList } from '../PlanList';
import { SUBJECT_COLORS, type TUSSubject } from '../../constants/subjects';
import { typography, radius, shadows, useThemeColors } from '../../ui/theme';

const toLocalDateStr = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface PhasePlanTabProps {
  structure: any;
  dailyTasks: any[];
  selectedDate: string;
  onChangeDate: (date: string) => void;
  onCompleteTask: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onUpdateTask: (id: number, data: any) => void;
  onAddTask: (data: any) => void;
}

export function PhasePlanTab({
  structure, dailyTasks, selectedDate,
  onChangeDate, onCompleteTask, onDeleteTask, onUpdateTask, onAddTask,
}: PhasePlanTabProps) {
  const c = useThemeColors();

  const changeDate = (offset: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + offset);
    onChangeDate(toLocalDateStr(current));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = toLocalDateStr(new Date());
    if (dateStr === today) return 'Bugün';
    return d.toLocaleDateString('tr-TR', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const blocks = structure?.blocks || [];
  const currentTask = dailyTasks.length > 0 ? dailyTasks[0] : null;
  const currentSubject = currentTask?.subject;
  const currentPhase = currentTask?.phase;

  const completedCount = dailyTasks.filter((t: any) => t.status === 'done').length;
  const totalMinutes = dailyTasks.reduce((s: number, t: any) => s + t.target_minutes, 0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={[styles.dateArrow, { backgroundColor: c.surface.containerLowest }]}>
          <MaterialIcons name="chevron-left" size={22} color={c.primary.main} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onChangeDate(toLocalDateStr(new Date()))} style={[styles.dateCenter, { backgroundColor: c.primary.main }]}>
          <Text style={[styles.dateCenterText, { color: c.white }]}>{formatDate(selectedDate)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeDate(1)} style={[styles.dateArrow, { backgroundColor: c.surface.containerLowest }]}>
          <MaterialIcons name="chevron-right" size={22} color={c.primary.main} />
        </TouchableOpacity>
      </View>

      {/* Current Phase Header */}
      {currentSubject && currentPhase && (
        <View style={[styles.phaseCard, { backgroundColor: c.surface.containerLowest }]}>
          <View style={[styles.phaseBar, { backgroundColor: SUBJECT_COLORS[currentSubject as TUSSubject] || c.primary.main }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.phaseSubject, { color: c.onSurface.main }]}>{currentSubject}</Text>
            <Text style={[styles.phaseMeta, { color: c.onSurface.variant }]}>
              {currentPhase === 'reading' ? 'Okuma Fazı' : 'Soru Fazı'}
            </Text>
          </View>
          <View style={[styles.phaseBadge, { backgroundColor: currentPhase === 'reading' ? '#dbeafe' : '#fef3c7' }]}>
            <Text style={[styles.phaseBadgeText, { color: currentPhase === 'reading' ? '#2563eb' : '#d97706' }]}>
              {currentPhase === 'reading' ? 'Okuma' : 'Soru'}
            </Text>
          </View>
        </View>
      )}

      {/* Day Summary */}
      {dailyTasks.length > 0 && (
        <View style={[styles.summaryRow, { backgroundColor: c.surface.containerLowest }]}>
          <Text style={[styles.summaryText, { color: c.onSurface.variant }]}>
            {completedCount}/{dailyTasks.length} görev • {totalMinutes} dk
          </Text>
          <View style={[styles.summaryBar, { backgroundColor: c.surface.containerHighest }]}>
            <View style={[styles.summaryFill, { width: `${dailyTasks.length > 0 ? (completedCount / dailyTasks.length) * 100 : 0}%` }]} />
          </View>
        </View>
      )}

      {/* Task List */}
      <PlanList
        tasks={dailyTasks}
        currentDate={selectedDate}
        planStartDate={structure?.start_date}
        planEndDate={structure?.end_date}
        onComplete={onCompleteTask}
        onDelete={onDeleteTask}
        onUpdateTask={onUpdateTask}
        onAddTask={onAddTask}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, paddingTop: 16 },

  // Date nav
  dateNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  dateArrow: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', ...shadows.sm,
  },
  dateCenter: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: radius.md },
  dateCenterText: { fontSize: 15, fontWeight: '700' },

  // Phase
  phaseCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8,
    borderRadius: radius.lg, padding: 14, gap: 12, ...shadows.sm,
  },
  phaseBar: { width: 4, height: 36, borderRadius: 2 },
  phaseSubject: { ...typography.bodyBold },
  phaseMeta: { ...typography.caption, marginTop: 2 },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  phaseBadgeText: { fontSize: 11, fontWeight: '700' },

  // Summary
  summaryRow: {
    marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: radius.md, ...shadows.sm,
  },
  summaryText: { ...typography.caption, marginBottom: 8 },
  summaryBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  summaryFill: { height: '100%', backgroundColor: '#22C55E', borderRadius: 2 },
});
