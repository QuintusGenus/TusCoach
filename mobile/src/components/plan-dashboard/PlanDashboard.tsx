import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { OverviewTab } from './OverviewTab';
import { PhasePlanTab } from './PhasePlanTab';
import { SampleWeekTab } from './SampleWeekTab';
import { SubjectsTab } from './SubjectsTab';
import { typography, radius, useThemeColors } from '../../ui/theme';
import type { SubjectBlock } from '../../api/coach';

const TABS = [
  { key: 'overview', label: 'Genel', icon: 'dashboard' },
  { key: 'phases', label: 'Fazlar', icon: 'view-agenda' },
  { key: 'week', label: 'Hafta', icon: 'date-range' },
  { key: 'subjects', label: 'Dersler', icon: 'school' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface PlanDashboardProps {
  overview: any;
  structure: any;
  dailyTasks: any[];
  selectedDate: string;
  onChangeDate: (date: string) => void;
  onCompleteTask: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onUpdateTask: (id: number, data: any) => void;
  onAddTask: (data: any) => void;
  onRegenerate: () => void;
}

export function PlanDashboard({
  overview, structure, dailyTasks, selectedDate,
  onChangeDate, onCompleteTask, onDeleteTask, onUpdateTask, onAddTask, onRegenerate,
}: PlanDashboardProps) {
  const c = useThemeColors();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                { borderBottomColor: isActive ? c.primary.main : 'transparent' },
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={tab.icon as any}
                size={18}
                color={isActive ? c.primary.main : c.outline.main}
              />
              <Text style={[styles.tabLabel, { color: isActive ? c.primary.main : c.outline.main }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab overview={overview} structure={structure} onRegenerate={onRegenerate} />
      )}
      {activeTab === 'phases' && (
        <PhasePlanTab
          structure={structure}
          dailyTasks={dailyTasks}
          selectedDate={selectedDate}
          onChangeDate={onChangeDate}
          onCompleteTask={onCompleteTask}
          onDeleteTask={onDeleteTask}
          onUpdateTask={onUpdateTask}
          onAddTask={onAddTask}
        />
      )}
      {activeTab === 'week' && (
        <SampleWeekTab structure={structure} dailyTasks={dailyTasks} selectedDate={selectedDate} />
      )}
      {activeTab === 'subjects' && (
        <SubjectsTab structure={structure} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexGrow: 0 },
  tabBarContent: { paddingHorizontal: 16, gap: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2,
  },
  tabLabel: { fontSize: 13, fontWeight: '600' },
});
