import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { usePlanGeneratorStore } from '../../state/planGeneratorStore';
import { mapBuilderToTur, type TurResult } from './TurMapper';
import {
  STATUS_OPTIONS, LEVEL_OPTIONS, WEEKDAY_LABELS, WEEKDAY_FULL,
  type UserStatus, type UserLevel,
} from '../../constants/planGenerator';
import { SUBJECT_COLORS, type TUSSubject } from '../../constants/subjects';
import { typography, radius, shadows, useThemeColors } from '../../ui/theme';

interface BuilderFlowProps {
  onGenerate: (turNumber: number) => void;
  isGenerating: boolean;
}

// ─── Mini Calendar Widget ───────────────────────────────────
function ShiftCalendar({ excludedDates, onToggle }: { excludedDates: string[]; onToggle: (date: string) => void }) {
  const c = useThemeColors();
  const [monthOffset, setMonthOffset] = useState(0);

  const baseDate = new Date();
  baseDate.setDate(1);
  baseDate.setMonth(baseDate.getMonth() + monthOffset);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const monthName = baseDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Mon=0
  const totalDays = lastDay.getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let i = 1; i <= totalDays; i++) cells.push(i);

  const toDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <View>
      <View style={calStyles.header}>
        <TouchableOpacity onPress={() => setMonthOffset(monthOffset - 1)} style={calStyles.navBtn}>
          <MaterialIcons name="chevron-left" size={20} color={c.primary.main} />
        </TouchableOpacity>
        <Text style={[calStyles.monthLabel, { color: c.onSurface.main }]}>{monthName}</Text>
        <TouchableOpacity onPress={() => setMonthOffset(monthOffset + 1)} style={calStyles.navBtn}>
          <MaterialIcons name="chevron-right" size={20} color={c.primary.main} />
        </TouchableOpacity>
      </View>
      {/* Day labels */}
      <View style={calStyles.weekRow}>
        {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map((d) => (
          <Text key={d} style={[calStyles.weekLabel, { color: c.onSurface.variant }]}>{d}</Text>
        ))}
      </View>
      {/* Days grid */}
      <View style={calStyles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`pad-${i}`} style={calStyles.cell} />;
          const dateStr = toDateStr(day);
          const cellDate = new Date(year, month, day);
          const isPast = cellDate < today;
          const isExcluded = excludedDates.includes(dateStr);
          return (
            <TouchableOpacity
              key={dateStr}
              style={[
                calStyles.cell,
                isExcluded && { backgroundColor: c.tertiary.main },
                isPast && { opacity: 0.3 },
              ]}
              onPress={() => !isPast && onToggle(dateStr)}
              disabled={isPast}
              activeOpacity={0.6}
            >
              <Text style={[calStyles.dayText, { color: isExcluded ? c.white : c.onSurface.main }]}>{day}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[calStyles.hint, { color: c.onSurface.variant }]}>
        {excludedDates.length > 0 ? `${excludedDates.length} gün hariç tutuldu` : 'Nöbet/izin günlerini seçin'}
      </Text>
    </View>
  );
}

const calStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: { padding: 4 },
  monthLabel: { ...typography.bodyBold, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', ...typography.tiny, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center',
    borderRadius: 8,
  },
  dayText: { fontSize: 13, fontWeight: '600' },
  hint: { ...typography.caption, textAlign: 'center', marginTop: 8 },
});

// ─── Main BuilderFlow ───────────────────────────────────────
export function BuilderFlow({ onGenerate, isGenerating }: BuilderFlowProps) {
  const c = useThemeColors();
  const store = usePlanGeneratorStore();
  const {
    examDate, status, level, weekdayHours, weekendHours, studyDays, styleRatio, excludedDates,
    subjectOrder, moveSubject,
    setExamDate, setStatus, setLevel, setWeekdayHours, setWeekendHours, setStudyDays, setStyleRatio,
    toggleExcludedDate, reset,
  } = store;

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showShiftCal, setShowShiftCal] = useState(false);
  const [showSubjectOrder, setShowSubjectOrder] = useState(false);

  const handleDateChange = (_: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setExamDate(selectedDate);
  };

  const toggleDay = (day: number) => {
    if (studyDays.includes(day)) {
      if (studyDays.length > 1) setStudyDays(studyDays.filter((d) => d !== day));
    } else {
      setStudyDays([...studyDays, day].sort());
    }
  };

  const canGenerate = status !== null && level !== null;

  // Dynamic preview — recomputes on every input change
  const turResult: TurResult | null = useMemo(() => {
    if (!canGenerate) return null;
    return mapBuilderToTur({
      examDate, weekdayHours, weekendHours, studyDays, excludedDates,
      status: status!, level: level!, styleRatio,
    });
  }, [examDate, weekdayHours, weekendHours, studyDays, excludedDates, status, level, styleRatio, canGenerate]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  const weekdayCount = studyDays.filter(d => d < 5).length;
  const weekendCount = studyDays.filter(d => d >= 5).length;
  const hoursPerWeek = (weekdayCount * weekdayHours) + (weekendCount * weekendHours);

  return (
    <View style={[styles.container, { backgroundColor: c.surface.main }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => reset()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={c.primary.main} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.onSurface.main }]}>Plan Oluşturucu</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        {/* ─── Exam Date ──────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: c.surface.containerLowest }]}>
          <Text style={[styles.sectionLabel, { color: c.onSurface.variant }]}>SINAV TARİHİ</Text>
          <TouchableOpacity
            style={[styles.dateField, { backgroundColor: c.surface.containerLow, borderColor: c.outline.variant + '40' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <MaterialIcons name="event" size={20} color={c.primary.main} />
            <Text style={[styles.dateFieldText, { color: examDate ? c.onSurface.main : c.outline.main }]}>
              {examDate ? formatDate(examDate) : 'Tarih seç (opsiyonel)'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker value={examDate || new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} minimumDate={new Date()} onChange={handleDateChange} />
          )}
          {Platform.OS === 'ios' && showDatePicker && (
            <TouchableOpacity onPress={() => setShowDatePicker(false)} style={[styles.iosBtn, { backgroundColor: c.primary.main }]}>
              <Text style={{ color: c.white, fontWeight: '600' }}>Tamam</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Status ─────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: c.surface.containerLowest }]}>
          <Text style={[styles.sectionLabel, { color: c.onSurface.variant }]}>DURUM</Text>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, { backgroundColor: c.surface.containerLow, borderColor: c.outline.variant + '30' }, status === opt.value && { backgroundColor: c.primary.main, borderColor: c.primary.main }]}
                onPress={() => setStatus(opt.value as UserStatus)}
              >
                <MaterialIcons name={opt.icon as any} size={16} color={status === opt.value ? c.white : c.onSurface.variant} />
                <Text style={[styles.chipText, { color: status === opt.value ? c.white : c.onSurface.main }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Level ──────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: c.surface.containerLowest }]}>
          <Text style={[styles.sectionLabel, { color: c.onSurface.variant }]}>SEVİYE</Text>
          <View style={styles.chipRow}>
            {LEVEL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, { backgroundColor: c.surface.containerLow, borderColor: c.outline.variant + '30' }, level === opt.value && { backgroundColor: c.primary.main, borderColor: c.primary.main }]}
                onPress={() => setLevel(opt.value as UserLevel)}
              >
                <MaterialIcons name={opt.icon as any} size={16} color={level === opt.value ? c.white : c.onSurface.variant} />
                <Text style={[styles.chipText, { color: level === opt.value ? c.white : c.onSurface.main }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Study Days ─────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: c.surface.containerLowest }]}>
          <Text style={[styles.sectionLabel, { color: c.onSurface.variant }]}>ÇALIŞMA GÜNLERİ</Text>
          <View style={styles.dayRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dayChip, { backgroundColor: c.surface.containerLow, borderColor: c.outline.variant + '30' }, studyDays.includes(i) && { backgroundColor: c.primary.main, borderColor: c.primary.main }]}
                onPress={() => toggleDay(i)}
              >
                <Text style={[styles.dayChipText, { color: studyDays.includes(i) ? c.white : c.onSurface.variant }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.hintText, { color: c.onSurface.variant }]}>{studyDays.length} gün / hafta</Text>
        </View>

        {/* ─── Weekday Hours ──────────────────────────────── */}
        {weekdayCount > 0 && (
          <View style={[styles.section, { backgroundColor: c.surface.containerLowest }]}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.sectionLabel, { color: c.onSurface.variant }]}>HAFTA İÇİ ÇALIŞMA</Text>
              <Text style={[styles.sliderValue, { color: c.primary.main }]}>{weekdayHours} saat</Text>
            </View>
            <Text style={[styles.hintText, { color: c.onSurface.variant, marginBottom: 4 }]}>Pzt-Cum günleri için günlük süre</Text>
            <Slider
              minimumValue={1} maximumValue={12} step={0.5}
              value={weekdayHours} onValueChange={setWeekdayHours}
              minimumTrackTintColor={c.primary.main}
              maximumTrackTintColor={c.surface.containerHighest}
              thumbTintColor={c.primary.main}
            />
          </View>
        )}

        {/* ─── Weekend Hours ──────────────────────────────── */}
        {weekendCount > 0 && (
          <View style={[styles.section, { backgroundColor: c.surface.containerLowest }]}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.sectionLabel, { color: c.onSurface.variant }]}>HAFTA SONU ÇALIŞMA</Text>
              <Text style={[styles.sliderValue, { color: c.secondary.main }]}>{weekendHours} saat</Text>
            </View>
            <Text style={[styles.hintText, { color: c.onSurface.variant, marginBottom: 4 }]}>Cmt-Paz günleri için günlük süre</Text>
            <Slider
              minimumValue={1} maximumValue={12} step={0.5}
              value={weekendHours} onValueChange={setWeekendHours}
              minimumTrackTintColor={c.secondary.main}
              maximumTrackTintColor={c.surface.containerHighest}
              thumbTintColor={c.secondary.main}
            />
          </View>
        )}

        {/* ─── Style Ratio ────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: c.surface.containerLowest }]}>
          <Text style={[styles.sectionLabel, { color: c.onSurface.variant }]}>ÇALIŞMA STİLİ</Text>
          <View style={styles.ratioLabels}>
            <Text style={[styles.ratioLabel, { color: c.onSurface.variant }]}>Okuma</Text>
            <Text style={[styles.ratioLabel, { color: c.onSurface.variant }]}>Soru</Text>
          </View>
          <Slider
            minimumValue={0} maximumValue={100} step={5}
            value={styleRatio} onValueChange={setStyleRatio}
            minimumTrackTintColor={c.secondary.main}
            maximumTrackTintColor={c.primary.main}
            thumbTintColor={c.primary.main}
          />
          <View style={styles.ratioLabels}>
            <Text style={[styles.ratioPercent, { color: c.secondary.main }]}>{100 - styleRatio}%</Text>
            <Text style={[styles.ratioPercent, { color: c.primary.main }]}>{styleRatio}%</Text>
          </View>
        </View>

        {/* ─── Shift / Excluded Days Calendar ─────────────── */}
        <View style={[styles.section, { backgroundColor: c.surface.containerLowest }]}>
          <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowShiftCal(!showShiftCal)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <MaterialIcons name="event-busy" size={20} color={c.tertiary.main} />
              <View>
                <Text style={[styles.sectionLabel, { color: c.onSurface.variant, marginBottom: 0 }]}>NÖBET / İZİN GÜNLERİ</Text>
                <Text style={[styles.hintText, { color: c.onSurface.variant }]}>
                  24 saat nöbet, tatil vb. çalışamayacağınız günler
                </Text>
              </View>
            </View>
            <MaterialIcons name={showShiftCal ? 'expand-less' : 'expand-more'} size={22} color={c.outline.main} />
          </TouchableOpacity>
          {showShiftCal && (
            <View style={{ marginTop: 12 }}>
              <ShiftCalendar excludedDates={excludedDates} onToggle={toggleExcludedDate} />
            </View>
          )}
        </View>

        {/* ─── Subject Order ───────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: c.surface.containerLowest }]}>
          <TouchableOpacity style={styles.sectionToggle} onPress={() => setShowSubjectOrder(!showSubjectOrder)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <MaterialIcons name="reorder" size={20} color={c.primary.main} />
              <View>
                <Text style={[styles.sectionLabel, { color: c.onSurface.variant, marginBottom: 0 }]}>DERS SIRASI</Text>
                <Text style={[styles.hintText, { color: c.onSurface.variant }]}>
                  Hangi dersten başlamak istediğinizi ayarlayın
                </Text>
              </View>
            </View>
            <MaterialIcons name={showSubjectOrder ? 'expand-less' : 'expand-more'} size={22} color={c.outline.main} />
          </TouchableOpacity>
          {showSubjectOrder && (
            <View style={{ marginTop: 12, gap: 4 }}>
              {subjectOrder.map((subject, index) => {
                const color = SUBJECT_COLORS[subject as TUSSubject] || c.outline.main;
                return (
                  <View key={subject} style={[styles.subjectRow, { backgroundColor: c.surface.containerLow }]}>
                    <View style={[styles.subjectDot, { backgroundColor: color }]} />
                    <Text style={[styles.subjectRowText, { color: c.onSurface.main }]}>
                      {index + 1}. {subject}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      <TouchableOpacity
                        onPress={() => index > 0 && moveSubject(index, index - 1)}
                        disabled={index === 0}
                        style={[styles.moveBtn, index === 0 && { opacity: 0.25 }]}
                      >
                        <MaterialIcons name="keyboard-arrow-up" size={22} color={c.primary.main} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => index < subjectOrder.length - 1 && moveSubject(index, index + 1)}
                        disabled={index === subjectOrder.length - 1}
                        style={[styles.moveBtn, index === subjectOrder.length - 1 && { opacity: 0.25 }]}
                      >
                        <MaterialIcons name="keyboard-arrow-down" size={22} color={c.primary.main} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ─── Live Preview ───────────────────────────────── */}
        {turResult && (
          <View style={[styles.previewCard, { backgroundColor: c.primary.container }]}>
            <Text style={[styles.previewLabel, { color: c.primary.onContainer }]}>PLAN ÖNİZLEME</Text>
            <Text style={[styles.previewTur, { color: c.primary.onContainer }]}>{turResult.label}</Text>
            <Text style={[styles.previewReason, { color: c.primary.onContainer }]}>{turResult.reasoning}</Text>

            {/* Dynamic stats */}
            <View style={[styles.previewStatsGrid, { backgroundColor: c.primary.main + '30' }]}>
              <View style={styles.previewStatItem}>
                <Text style={[styles.previewStatValue, { color: c.primary.onContainer }]}>{turResult.estimatedWeeks}</Text>
                <Text style={[styles.previewStatLabel, { color: c.primary.onContainer }]}>hafta</Text>
              </View>
              <View style={styles.previewStatItem}>
                <Text style={[styles.previewStatValue, { color: c.primary.onContainer }]}>{turResult.estimatedDays}</Text>
                <Text style={[styles.previewStatLabel, { color: c.primary.onContainer }]}>çalışma günü</Text>
              </View>
              <View style={styles.previewStatItem}>
                <Text style={[styles.previewStatValue, { color: c.primary.onContainer }]}>{Math.round(hoursPerWeek)}</Text>
                <Text style={[styles.previewStatLabel, { color: c.primary.onContainer }]}>saat/hafta</Text>
              </View>
              <View style={styles.previewStatItem}>
                <Text style={[styles.previewStatValue, { color: c.primary.onContainer }]}>{turResult.totalStudyHours}</Text>
                <Text style={[styles.previewStatLabel, { color: c.primary.onContainer }]}>toplam saat</Text>
              </View>
            </View>

            {/* Subject color bar */}
            <View style={styles.subjectBar}>
              {Object.entries(SUBJECT_COLORS).map(([sub, color]) => (
                <View key={sub} style={[styles.subjectBarSegment, { backgroundColor: color }]} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ─── Fixed Generate Button ────────────────────────── */}
      <View style={[styles.bottomBar, { backgroundColor: c.surface.main, borderTopColor: c.surface.containerHigh }]}>
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: canGenerate ? c.primary.main : c.surface.containerHigh }]}
          onPress={() => turResult && onGenerate(turResult.turNumber)}
          disabled={!canGenerate || isGenerating}
          activeOpacity={0.85}
        >
          {isGenerating ? (
            <ActivityIndicator color={c.white} />
          ) : (
            <>
              <MaterialIcons name="auto-awesome" size={22} color={canGenerate ? c.white : c.outline.main} />
              <Text style={[styles.generateBtnText, { color: canGenerate ? c.white : c.outline.main }]}>
                Planı Oluştur
              </Text>
            </>
          )}
        </TouchableOpacity>
        {!canGenerate && (
          <Text style={[styles.generateHint, { color: c.onSurface.variant }]}>Durum ve seviye seçimi zorunlu</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...typography.h3 },
  scroll: { flex: 1, paddingHorizontal: 20 },

  section: { borderRadius: radius.xl, padding: 16, marginBottom: 12, ...shadows.sm },
  sectionLabel: { ...typography.labelWide, marginBottom: 10 },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hintText: { ...typography.caption, marginTop: 4 },

  dateField: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1 },
  dateFieldText: { ...typography.body },
  iosBtn: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: radius.md, marginTop: 8 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },

  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderValue: { fontSize: 22, fontWeight: '800' },

  dayRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  dayChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5 },
  dayChipText: { fontSize: 12, fontWeight: '700' },

  ratioLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  ratioLabel: { ...typography.caption },
  ratioPercent: { ...typography.bodyBold },

  // Subject reorder
  subjectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
  },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  subjectRowText: { ...typography.bodyBold, fontSize: 14, flex: 1 },
  moveBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Preview
  previewCard: { borderRadius: radius['2xl'], padding: 20, marginBottom: 12 },
  previewLabel: { ...typography.labelWide, marginBottom: 6, opacity: 0.7 },
  previewTur: { ...typography.h3, marginBottom: 4 },
  previewReason: { ...typography.caption, marginBottom: 16, opacity: 0.85, lineHeight: 18 },
  previewStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: radius.lg, padding: 14, gap: 0 },
  previewStatItem: { width: '50%', alignItems: 'center', paddingVertical: 8 },
  previewStatValue: { fontSize: 24, fontWeight: '800' },
  previewStatLabel: { ...typography.tiny, marginTop: 2, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 },
  subjectBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 14, gap: 2 },
  subjectBarSegment: { flex: 1, borderRadius: 3 },

  // Bottom
  bottomBar: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 12, borderTopWidth: 1 },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: radius.lg, ...shadows.hero,
  },
  generateBtnText: { fontSize: 17, fontWeight: '700' },
  generateHint: { ...typography.caption, textAlign: 'center', marginTop: 8 },
});
