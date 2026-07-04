import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { usePlanGeneratorStore } from '../../state/planGeneratorStore';
import { mapWizardToTur, type TurResult } from './TurMapper';
import {
  WIZARD_STEPS, STATUS_OPTIONS, LEVEL_OPTIONS, STYLE_OPTIONS,
  type UserStatus, type UserLevel, type StudyStyle,
} from '../../constants/planGenerator';
import { typography, radius, shadows, useThemeColors } from '../../ui/theme';

interface WizardFlowProps {
  onGenerate: (turNumber: number) => void;
  isGenerating: boolean;
}

export function WizardFlow({ onGenerate, isGenerating }: WizardFlowProps) {
  const c = useThemeColors();
  const store = usePlanGeneratorStore();
  const { wizardStep, examDate, status, level, style, setWizardStep, setExamDate, setStatus, setLevel, setStyle, reset } = store;

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [turResult, setTurResult] = useState<TurResult | null>(null);

  const stepCount = WIZARD_STEPS.length;
  const currentStepKey = WIZARD_STEPS[wizardStep];

  const canProceed = () => {
    switch (currentStepKey) {
      case 'exam_date': return true; // optional
      case 'status': return status !== null;
      case 'level': return level !== null;
      case 'style': return style !== null;
      default: return false;
    }
  };

  const handleNext = () => {
    if (wizardStep < stepCount - 1) {
      setWizardStep(wizardStep + 1);
    } else {
      // Final step — compute tur and generate
      const result = mapWizardToTur({
        examDate,
        status: status!,
        level: level!,
        style: style!,
      });
      setTurResult(result);
    }
  };

  const handleBack = () => {
    if (turResult) {
      setTurResult(null);
    } else if (wizardStep > 0) {
      setWizardStep(wizardStep - 1);
    } else {
      reset();
    }
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setExamDate(selectedDate);
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  // ─── Result Screen ─────────────────────────────────────────
  if (turResult) {
    return (
      <View style={[styles.container, { backgroundColor: c.surface.main }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={c.primary.main} />
        </TouchableOpacity>

        <View style={styles.resultCenter}>
          <View style={[styles.resultIcon, { backgroundColor: c.primary.container }]}>
            <MaterialIcons name="check-circle" size={48} color={c.primary.onContainer} />
          </View>
          <Text style={[styles.resultTitle, { color: c.onSurface.main }]}>Planınız Hazır!</Text>
          <Text style={[styles.resultLabel, { color: c.primary.main }]}>{turResult.label}</Text>
          <Text style={[styles.resultReason, { color: c.onSurface.variant }]}>{turResult.reasoning}</Text>

          <View style={[styles.resultStats, { backgroundColor: c.surface.containerLow }]}>
            <View style={styles.resultStatItem}>
              <Text style={[styles.resultStatValue, { color: c.primary.main }]}>{turResult.estimatedDays}</Text>
              <Text style={[styles.resultStatLabel, { color: c.onSurface.variant }]}>gün</Text>
            </View>
            <View style={[styles.resultStatDivider, { backgroundColor: c.outline.variant }]} />
            <View style={styles.resultStatItem}>
              <Text style={[styles.resultStatValue, { color: c.primary.main }]}>{Math.ceil(turResult.estimatedDays / 7)}</Text>
              <Text style={[styles.resultStatLabel, { color: c.onSurface.variant }]}>hafta</Text>
            </View>
            <View style={[styles.resultStatDivider, { backgroundColor: c.outline.variant }]} />
            <View style={styles.resultStatItem}>
              <Text style={[styles.resultStatValue, { color: c.primary.main }]}>11</Text>
              <Text style={[styles.resultStatLabel, { color: c.onSurface.variant }]}>ders</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: c.primary.main }]}
            onPress={() => onGenerate(turResult.turNumber)}
            disabled={isGenerating}
            activeOpacity={0.85}
          >
            {isGenerating ? (
              <ActivityIndicator color={c.white} />
            ) : (
              <>
                <MaterialIcons name="auto-awesome" size={20} color={c.white} />
                <Text style={[styles.generateBtnText, { color: c.white }]}>Planı Oluştur</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Wizard Steps ──────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: c.surface.main }]}>
      {/* Header */}
      <View style={styles.stepHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={c.primary.main} />
        </TouchableOpacity>
        <View style={styles.progressDots}>
          {WIZARD_STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i <= wizardStep ? c.primary.main : c.surface.containerHighest },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.stepCounter, { color: c.onSurface.variant }]}>
          {wizardStep + 1}/{stepCount}
        </Text>
      </View>

      {/* Step Content */}
      <View style={styles.stepContent}>
        {currentStepKey === 'exam_date' && (
          <>
            <Text style={[styles.stepTitle, { color: c.onSurface.main }]}>Sınav Tarihiniz</Text>
            <Text style={[styles.stepSubtitle, { color: c.onSurface.variant }]}>
              TUS sınav tarihinizi biliyorsanız seçin. Bilmiyorsanız atlayabilirsiniz.
            </Text>

            {examDate && (
              <View style={[styles.dateDisplay, { backgroundColor: c.surface.containerLow }]}>
                <MaterialIcons name="event" size={20} color={c.primary.main} />
                <Text style={[styles.dateText, { color: c.onSurface.main }]}>{formatDate(examDate)}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.dateBtn, { backgroundColor: c.surface.containerLowest, borderColor: c.outline.variant + '40' }]}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialIcons name="calendar-today" size={20} color={c.primary.main} />
              <Text style={[styles.dateBtnText, { color: c.primary.main }]}>
                {examDate ? 'Tarihi Değiştir' : 'Tarih Seç'}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={examDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={handleDateChange}
              />
            )}
            {Platform.OS === 'ios' && showDatePicker && (
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={[styles.iosDateDone, { backgroundColor: c.primary.main }]}>
                <Text style={{ color: c.white, fontWeight: '600' }}>Tamam</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {currentStepKey === 'status' && (
          <>
            <Text style={[styles.stepTitle, { color: c.onSurface.main }]}>Durumunuz</Text>
            <Text style={[styles.stepSubtitle, { color: c.onSurface.variant }]}>TUS hazırlığınızda neredesiniz?</Text>
            <View style={styles.optionsColumn}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionCard,
                    { backgroundColor: c.surface.containerLowest, borderColor: c.outline.variant + '40' },
                    status === opt.value && { backgroundColor: c.primary.container, borderColor: c.primary.main },
                  ]}
                  onPress={() => setStatus(opt.value as UserStatus)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIcon, { backgroundColor: status === opt.value ? c.primary.main : c.surface.containerHigh }]}>
                    <MaterialIcons name={opt.icon as any} size={22} color={status === opt.value ? c.white : c.onSurface.variant} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: status === opt.value ? c.primary.onContainer : c.onSurface.main }]}>{opt.label}</Text>
                    <Text style={[styles.optionDesc, { color: status === opt.value ? c.primary.onContainer : c.onSurface.variant }]}>{opt.description}</Text>
                  </View>
                  {status === opt.value && <MaterialIcons name="check-circle" size={22} color={c.primary.main} />}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {currentStepKey === 'level' && (
          <>
            <Text style={[styles.stepTitle, { color: c.onSurface.main }]}>Seviyeniz</Text>
            <Text style={[styles.stepSubtitle, { color: c.onSurface.variant }]}>Kendinizi nasıl değerlendirirsiniz?</Text>
            <View style={styles.optionsColumn}>
              {LEVEL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionCard,
                    { backgroundColor: c.surface.containerLowest, borderColor: c.outline.variant + '40' },
                    level === opt.value && { backgroundColor: c.primary.container, borderColor: c.primary.main },
                  ]}
                  onPress={() => setLevel(opt.value as UserLevel)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIcon, { backgroundColor: level === opt.value ? c.primary.main : c.surface.containerHigh }]}>
                    <MaterialIcons name={opt.icon as any} size={22} color={level === opt.value ? c.white : c.onSurface.variant} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: level === opt.value ? c.primary.onContainer : c.onSurface.main }]}>{opt.label}</Text>
                    <Text style={[styles.optionDesc, { color: level === opt.value ? c.primary.onContainer : c.onSurface.variant }]}>{opt.description}</Text>
                  </View>
                  {level === opt.value && <MaterialIcons name="check-circle" size={22} color={c.primary.main} />}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {currentStepKey === 'style' && (
          <>
            <Text style={[styles.stepTitle, { color: c.onSurface.main }]}>Çalışma Stili</Text>
            <Text style={[styles.stepSubtitle, { color: c.onSurface.variant }]}>Nasıl çalışmayı tercih ediyorsunuz?</Text>
            <View style={styles.optionsColumn}>
              {STYLE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionCard,
                    { backgroundColor: c.surface.containerLowest, borderColor: c.outline.variant + '40' },
                    style === opt.value && { backgroundColor: c.primary.container, borderColor: c.primary.main },
                  ]}
                  onPress={() => setStyle(opt.value as StudyStyle)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIcon, { backgroundColor: style === opt.value ? c.primary.main : c.surface.containerHigh }]}>
                    <MaterialIcons name={opt.icon as any} size={22} color={style === opt.value ? c.white : c.onSurface.variant} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: style === opt.value ? c.primary.onContainer : c.onSurface.main }]}>{opt.label}</Text>
                    <Text style={[styles.optionDesc, { color: style === opt.value ? c.primary.onContainer : c.onSurface.variant }]}>{opt.description}</Text>
                  </View>
                  {style === opt.value && <MaterialIcons name="check-circle" size={22} color={c.primary.main} />}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      {/* Navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: canProceed() ? c.primary.main : c.surface.containerHigh }]}
          onPress={handleNext}
          disabled={!canProceed()}
          activeOpacity={0.85}
        >
          <Text style={[styles.nextBtnText, { color: canProceed() ? c.white : c.outline.main }]}>
            {wizardStep === stepCount - 1 ? 'Planı Görüntüle' : currentStepKey === 'exam_date' ? (examDate ? 'Devam Et' : 'Atla') : 'Devam Et'}
          </Text>
          <MaterialIcons name="arrow-forward" size={20} color={canProceed() ? c.white : c.outline.main} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  progressDots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stepCounter: { ...typography.caption, minWidth: 30, textAlign: 'right' },

  stepContent: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  stepTitle: { ...typography.h2, marginBottom: 8 },
  stepSubtitle: { ...typography.body, marginBottom: 24 },

  // Date step
  dateDisplay: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16,
    borderRadius: radius.lg, marginBottom: 12,
  },
  dateText: { ...typography.bodyBold, fontSize: 16 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: radius.lg, borderWidth: 1.5,
  },
  dateBtnText: { ...typography.bodyBold },
  iosDateDone: {
    alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: radius.md, marginTop: 8,
  },

  // Options
  optionsColumn: { gap: 12 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: radius.lg,
    borderWidth: 1.5, gap: 14,
  },
  optionIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  optionLabel: { ...typography.bodyBold },
  optionDesc: { ...typography.caption, marginTop: 2 },

  // Navigation
  navRow: { paddingHorizontal: 24, paddingBottom: 100, paddingTop: 12 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: radius.lg, ...shadows.md,
  },
  nextBtnText: { fontSize: 16, fontWeight: '700' },

  // Result
  resultCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 120 },
  resultIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  resultTitle: { ...typography.h2, marginBottom: 8 },
  resultLabel: { ...typography.h3, marginBottom: 8 },
  resultReason: { ...typography.body, textAlign: 'center', marginBottom: 24 },
  resultStats: {
    flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: 20, gap: 0,
    marginBottom: 32, width: '100%',
  },
  resultStatItem: { flex: 1, alignItems: 'center' },
  resultStatValue: { fontSize: 28, fontWeight: '800' },
  resultStatLabel: { ...typography.tiny, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  resultStatDivider: { width: 1, height: 32, opacity: 0.3 },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, paddingHorizontal: 32, borderRadius: radius.lg, ...shadows.hero, width: '100%',
  },
  generateBtnText: { fontSize: 16, fontWeight: '700' },
});
