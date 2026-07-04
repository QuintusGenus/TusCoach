import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { updatePreferences, StudentPreferencesUpdate } from '../src/api/coach';
import { useAuthStore } from '../src/state/authStore';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const STEPS = ['exam_date', 'targets', 'study_window', 'quiet_hours'] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, string> = {
  exam_date: 'Sınavınız ne zaman?',
  targets: 'Günlük çalışma hedefleri',
  study_window: 'Tercih edilen çalışma saatleri',
  quiet_hours: 'Sessiz saatler (isteğe bağlı)',
};

const STEP_SUBTITLES: Record<Step, string> = {
  exam_date: 'Hazırlık sürecinizi planlamanıza yardımcı olacağız.',
  targets: 'Hafta içi ve hafta sonu için ideal günlük çalışma dakikanızı belirleyin.',
  study_window: 'Ne zaman çalışmayı tercih ediyorsunuz? Bu, görevlerinizi planlamanıza yardımcı olur.',
  quiet_hours: 'Bu saatlerde bildirim göndermeyeceğiz.',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const setOnboardingDone = useAuthStore((s) => s.setOnboardingDone);
  const [stepIndex, setStepIndex] = useState(0);

  // Form state
  const [examDate, setExamDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weekdayMinutes, setWeekdayMinutes] = useState('120');
  const [weekendMinutes, setWeekendMinutes] = useState('60');
  const [studyStart, setStudyStart] = useState<Date>(createTime(9, 0));
  const [studyEnd, setStudyEnd] = useState<Date>(createTime(18, 0));
  const [showStudyStartPicker, setShowStudyStartPicker] = useState(false);
  const [showStudyEndPicker, setShowStudyEndPicker] = useState(false);
  const [quietStart, setQuietStart] = useState<Date>(createTime(23, 0));
  const [quietEnd, setQuietEnd] = useState<Date>(createTime(7, 0));
  const [showQuietStartPicker, setShowQuietStartPicker] = useState(false);
  const [showQuietEndPicker, setShowQuietEndPicker] = useState(false);
  const [enableQuietHours, setEnableQuietHours] = useState(false);

  const currentStep = STEPS[stepIndex];

  const mutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: () => {
      setOnboardingDone(true);
      router.replace('/(tabs)');
    },
    onError: (err: any) => {
      Alert.alert('Hata', 'Tercihler kaydedilemedi. Lütfen tekrar deneyin.');
      console.error('[Onboarding] Save failed:', err);
    },
  });

  function createTime(hours: number, minutes: number): Date {
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  function formatTime(d: Date): string {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function toTimeString(d: Date): string {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}:00`;
  }

  function formatDate(d: Date): string {
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function handleNext() {
    // Validate current step
    if (currentStep === 'targets') {
      const wd = parseInt(weekdayMinutes, 10);
      const we = parseInt(weekendMinutes, 10);
      if (isNaN(wd) || wd < 5 || wd > 1000) {
        Alert.alert('Geçersiz', 'Hafta içi dakika 5 ile 1000 arasında olmalıdır.');
        return;
      }
      if (isNaN(we) || we < 5 || we > 1000) {
        Alert.alert('Geçersiz', 'Hafta sonu dakika 5 ile 1000 arasında olmalıdır.');
        return;
      }
    }

    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      handleSubmit();
    }
  }

  function handleBack() {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  }

  function handleSubmit() {
    const data: StudentPreferencesUpdate = {
      daily_target_minutes_weekday: parseInt(weekdayMinutes, 10),
      daily_target_minutes_weekend: parseInt(weekendMinutes, 10),
      preferred_study_window_start: toTimeString(studyStart),
      preferred_study_window_end: toTimeString(studyEnd),
    };

    if (examDate) {
      data.exam_date = examDate.toISOString().split('T')[0];
    }

    if (enableQuietHours) {
      data.quiet_hours_start = toTimeString(quietStart);
      data.quiet_hours_end = toTimeString(quietEnd);
    }

    mutation.mutate(data);
  }

  function handleSkip() {
    // Skip onboarding entirely with just the minimum required (targets)
    if (currentStep === 'exam_date') {
      setStepIndex(stepIndex + 1);
      return;
    }
    if (currentStep === 'study_window' || currentStep === 'quiet_hours') {
      if (currentStep === 'quiet_hours') {
        handleSubmit();
      } else {
        setStepIndex(stepIndex + 1);
      }
      return;
    }
  }

  const canSkip = currentStep !== 'targets';
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i <= stepIndex ? styles.progressDotActive : styles.progressDotInactive,
              ]}
            />
          ))}
        </View>

        <Text style={styles.title}>{STEP_TITLES[currentStep]}</Text>
        <Text style={styles.subtitle}>{STEP_SUBTITLES[currentStep]}</Text>

        {/* Step Content */}
        <View style={styles.stepContent}>
          {currentStep === 'exam_date' && (
            <ExamDateStep
              examDate={examDate}
              setExamDate={setExamDate}
              showDatePicker={showDatePicker}
              setShowDatePicker={setShowDatePicker}
              formatDate={formatDate}
            />
          )}
          {currentStep === 'targets' && (
            <TargetsStep
              weekdayMinutes={weekdayMinutes}
              setWeekdayMinutes={setWeekdayMinutes}
              weekendMinutes={weekendMinutes}
              setWeekendMinutes={setWeekendMinutes}
            />
          )}
          {currentStep === 'study_window' && (
            <StudyWindowStep
              studyStart={studyStart}
              setStudyStart={setStudyStart}
              studyEnd={studyEnd}
              setStudyEnd={setStudyEnd}
              showStartPicker={showStudyStartPicker}
              setShowStartPicker={setShowStudyStartPicker}
              showEndPicker={showStudyEndPicker}
              setShowEndPicker={setShowStudyEndPicker}
              formatTime={formatTime}
            />
          )}
          {currentStep === 'quiet_hours' && (
            <QuietHoursStep
              enabled={enableQuietHours}
              setEnabled={setEnableQuietHours}
              quietStart={quietStart}
              setQuietStart={setQuietStart}
              quietEnd={quietEnd}
              setQuietEnd={setQuietEnd}
              showStartPicker={showQuietStartPicker}
              setShowStartPicker={setShowQuietStartPicker}
              showEndPicker={showQuietEndPicker}
              setShowEndPicker={setShowQuietEndPicker}
              formatTime={formatTime}
            />
          )}
        </View>

        {/* Navigation */}
        <View style={styles.navContainer}>
          {stepIndex > 0 && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>Geri</Text>
            </TouchableOpacity>
          )}

          <View style={styles.navRight}>
            {canSkip && (
              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipButtonText}>Atla</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleNext}
              style={[styles.nextButton, mutation.isPending && styles.buttonDisabled]}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextButtonText}>
                  {isLastStep ? 'Tamamla' : 'İleri'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --- Step Components ---

function ExamDateStep({
  examDate,
  setExamDate,
  showDatePicker,
  setShowDatePicker,
  formatDate,
}: {
  examDate: Date | null;
  setExamDate: (d: Date | null) => void;
  showDatePicker: boolean;
  setShowDatePicker: (v: boolean) => void;
  formatDate: (d: Date) => string;
}) {
  const handleChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setExamDate(selectedDate);
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <View>
      <TouchableOpacity
        onPress={() => setShowDatePicker(true)}
        style={styles.pickerButton}
      >
        <Text style={styles.pickerButtonLabel}>Sınav Tarihi</Text>
        <Text style={styles.pickerButtonValue}>
          {examDate ? formatDate(examDate) : 'Seçmek için dokunun'}
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={examDate || tomorrow}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={tomorrow}
          onChange={handleChange}
        />
      )}

      {Platform.OS === 'ios' && showDatePicker && (
        <TouchableOpacity
          onPress={() => setShowDatePicker(false)}
          style={styles.donePickerButton}
        >
          <Text style={styles.donePickerText}>Tamam</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function TargetsStep({
  weekdayMinutes,
  setWeekdayMinutes,
  weekendMinutes,
  setWeekendMinutes,
}: {
  weekdayMinutes: string;
  setWeekdayMinutes: (v: string) => void;
  weekendMinutes: string;
  setWeekendMinutes: (v: string) => void;
}) {
  return (
    <View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Hafta İçi (Pzt-Cum)</Text>
        <View style={styles.minutesRow}>
          <TextInput
            style={styles.minutesInput}
            value={weekdayMinutes}
            onChangeText={setWeekdayMinutes}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Text style={styles.minutesSuffix}>dk/gün</Text>
        </View>
        <Text style={styles.inputHint}>
          {parseInt(weekdayMinutes) > 0
            ? `günde ${Math.floor(parseInt(weekdayMinutes) / 60)}s ${parseInt(weekdayMinutes) % 60}d`
            : ''}
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Hafta Sonu (Cmt-Paz)</Text>
        <View style={styles.minutesRow}>
          <TextInput
            style={styles.minutesInput}
            value={weekendMinutes}
            onChangeText={setWeekendMinutes}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Text style={styles.minutesSuffix}>dk/gün</Text>
        </View>
        <Text style={styles.inputHint}>
          {parseInt(weekendMinutes) > 0
            ? `günde ${Math.floor(parseInt(weekendMinutes) / 60)}s ${parseInt(weekendMinutes) % 60}d`
            : ''}
        </Text>
      </View>
    </View>
  );
}

function StudyWindowStep({
  studyStart,
  setStudyStart,
  studyEnd,
  setStudyEnd,
  showStartPicker,
  setShowStartPicker,
  showEndPicker,
  setShowEndPicker,
  formatTime,
}: {
  studyStart: Date;
  setStudyStart: (d: Date) => void;
  studyEnd: Date;
  setStudyEnd: (d: Date) => void;
  showStartPicker: boolean;
  setShowStartPicker: (v: boolean) => void;
  showEndPicker: boolean;
  setShowEndPicker: (v: boolean) => void;
  formatTime: (d: Date) => string;
}) {
  return (
    <View>
      <TimePickerRow
        label="Başlangıç"
        value={studyStart}
        onChange={setStudyStart}
        showPicker={showStartPicker}
        setShowPicker={setShowStartPicker}
        formatTime={formatTime}
      />
      <TimePickerRow
        label="Bitiş"
        value={studyEnd}
        onChange={setStudyEnd}
        showPicker={showEndPicker}
        setShowPicker={setShowEndPicker}
        formatTime={formatTime}
      />
    </View>
  );
}

function QuietHoursStep({
  enabled,
  setEnabled,
  quietStart,
  setQuietStart,
  quietEnd,
  setQuietEnd,
  showStartPicker,
  setShowStartPicker,
  showEndPicker,
  setShowEndPicker,
  formatTime,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  quietStart: Date;
  setQuietStart: (d: Date) => void;
  quietEnd: Date;
  setQuietEnd: (d: Date) => void;
  showStartPicker: boolean;
  setShowStartPicker: (v: boolean) => void;
  showEndPicker: boolean;
  setShowEndPicker: (v: boolean) => void;
  formatTime: (d: Date) => string;
}) {
  return (
    <View>
      <TouchableOpacity
        onPress={() => setEnabled(!enabled)}
        style={styles.toggleRow}
      >
        <Text style={styles.toggleLabel}>Sessiz saatleri etkinleştir</Text>
        <View style={[styles.toggle, enabled && styles.toggleActive]}>
          <View style={[styles.toggleThumb, enabled && styles.toggleThumbActive]} />
        </View>
      </TouchableOpacity>

      {enabled && (
        <View style={styles.quietTimePickers}>
          <TimePickerRow
            label="Başlangıç"
            value={quietStart}
            onChange={setQuietStart}
            showPicker={showStartPicker}
            setShowPicker={setShowStartPicker}
            formatTime={formatTime}
          />
          <TimePickerRow
            label="Bitiş"
            value={quietEnd}
            onChange={setQuietEnd}
            showPicker={showEndPicker}
            setShowPicker={setShowEndPicker}
            formatTime={formatTime}
          />
        </View>
      )}
    </View>
  );
}

function TimePickerRow({
  label,
  value,
  onChange,
  showPicker,
  setShowPicker,
  formatTime,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  formatTime: (d: Date) => string;
}) {
  const handleChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <View style={styles.timePickerRow}>
      <TouchableOpacity
        onPress={() => setShowPicker(!showPicker)}
        style={styles.pickerButton}
      >
        <Text style={styles.pickerButtonLabel}>{label}</Text>
        <Text style={styles.pickerButtonValue}>{formatTime(value)}</Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={value}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          is24Hour={true}
        />
      )}

      {Platform.OS === 'ios' && showPicker && (
        <TouchableOpacity
          onPress={() => setShowPicker(false)}
          style={styles.donePickerButton}
        >
          <Text style={styles.donePickerText}>Tamam</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: '#004225',
  },
  progressDotInactive: {
    backgroundColor: '#d1d5db',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 32,
    lineHeight: 22,
  },
  stepContent: {
    flex: 1,
    marginBottom: 32,
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 'auto',
  },
  backButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#004225',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Picker button
  pickerButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  pickerButtonLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  pickerButtonValue: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '600',
  },
  donePickerButton: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  donePickerText: {
    color: '#004225',
    fontSize: 16,
    fontWeight: '600',
  },
  // Targets
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 8,
  },
  minutesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  minutesInput: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    width: 100,
    textAlign: 'center',
  },
  minutesSuffix: {
    fontSize: 15,
    color: '#6b7280',
  },
  inputHint: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  // Toggle
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#004225',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  quietTimePickers: {
    marginTop: 4,
  },
  timePickerRow: {
    marginBottom: 4,
  },
});
