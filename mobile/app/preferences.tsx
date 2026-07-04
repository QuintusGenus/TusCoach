import { useState, useEffect } from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPreferences,
  updatePreferences,
  StudentPreferencesUpdate,
} from '../src/api/coach';
import { updateProfile } from '../src/api/auth';
import { useAuthStore } from '../src/state/authStore';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, shadows, typography } from '../src/ui/theme';

function parseTimeString(timeStr: string | null): Date {
  const d = new Date();
  if (!timeStr) {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const parts = timeStr.split(':');
  d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
  return d;
}

function toTimeString(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PreferencesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore(s => s.setAuth);
  const token = useAuthStore(s => s.token);
  const currentUser = useAuthStore(s => s.user);

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
  });

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [examDate, setExamDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weekdayMinutes, setWeekdayMinutes] = useState('');
  const [weekendMinutes, setWeekendMinutes] = useState('');
  const [studyStart, setStudyStart] = useState<Date>(new Date());
  const [studyEnd, setStudyEnd] = useState<Date>(new Date());
  const [showStudyStartPicker, setShowStudyStartPicker] = useState(false);
  const [showStudyEndPicker, setShowStudyEndPicker] = useState(false);
  const [quietStart, setQuietStart] = useState<Date>(new Date());
  const [quietEnd, setQuietEnd] = useState<Date>(new Date());
  const [showQuietStartPicker, setShowQuietStartPicker] = useState(false);
  const [showQuietEndPicker, setShowQuietEndPicker] = useState(false);
  const [enableQuietHours, setEnableQuietHours] = useState(false);

  // Populate display name from auth store
  useEffect(() => {
    if (currentUser?.display_name) {
      setDisplayName(currentUser.display_name);
    }
  }, [currentUser]);

  // Populate form from server data
  useEffect(() => {
    if (!prefs) return;
    if (prefs.exam_date) setExamDate(new Date(prefs.exam_date + 'T00:00:00'));
    if (prefs.daily_target_minutes_weekday != null)
      setWeekdayMinutes(String(prefs.daily_target_minutes_weekday));
    if (prefs.daily_target_minutes_weekend != null)
      setWeekendMinutes(String(prefs.daily_target_minutes_weekend));
    setStudyStart(parseTimeString(prefs.preferred_study_window_start));
    setStudyEnd(parseTimeString(prefs.preferred_study_window_end));
    setQuietStart(parseTimeString(prefs.quiet_hours_start));
    setQuietEnd(parseTimeString(prefs.quiet_hours_end));
    setEnableQuietHours(prefs.quiet_hours_start != null && prefs.quiet_hours_end != null);
  }, [prefs]);

  const mutation = useMutation({
    mutationFn: async (data: StudentPreferencesUpdate) => {
      // Save display name if changed
      const trimmedName = displayName.trim();
      if (trimmedName !== (currentUser?.display_name || '')) {
        const updatedUser = await updateProfile({ display_name: trimmedName || undefined });
        if (token && updatedUser) {
          setAuth(token, updatedUser);
        }
      }
      // Save preferences
      return updatePreferences(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      Alert.alert('Kaydedildi', 'Tercihleriniz güncellendi.');
      router.back();
    },
    onError: () => {
      Alert.alert('Hata', 'Tercihler kaydedilemedi. Lütfen tekrar deneyin.');
    },
  });

  function handleSave() {
    const trimmedName = displayName.trim();
    if (trimmedName.length > 50) {
      Alert.alert('Geçersiz', 'İsim en fazla 50 karakter olmalıdır.');
      return;
    }
    const wd = parseInt(weekdayMinutes, 10);
    const we = parseInt(weekendMinutes, 10);
    if (weekdayMinutes && (isNaN(wd) || wd < 5 || wd > 1000)) {
      Alert.alert('Geçersiz', 'Hafta içi dakika 5 ile 1000 arasında olmalıdır.');
      return;
    }
    if (weekendMinutes && (isNaN(we) || we < 5 || we > 1000)) {
      Alert.alert('Geçersiz', 'Hafta sonu dakika 5 ile 1000 arasında olmalıdır.');
      return;
    }

    const data: StudentPreferencesUpdate = {};

    if (examDate) {
      data.exam_date = examDate.toISOString().split('T')[0];
    }
    if (weekdayMinutes) {
      data.daily_target_minutes_weekday = wd;
    }
    if (weekendMinutes) {
      data.daily_target_minutes_weekend = we;
    }
    data.preferred_study_window_start = toTimeString(studyStart);
    data.preferred_study_window_end = toTimeString(studyEnd);

    if (enableQuietHours) {
      data.quiet_hours_start = toTimeString(quietStart);
      data.quiet_hours_end = toTimeString(quietEnd);
    }

    mutation.mutate(data);
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={16} color={colors.primary[500]} />
            <Text style={styles.backText}>Ayarlar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Tercihler</Text>
        </View>

        {/* Display Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Görünen İsim</Text>
          <TextInput
            style={styles.nameInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Adınızı girin"
            maxLength={50}
            autoCapitalize="words"
          />
          <Text style={styles.nameHint}>Ana sayfada görünecek isminiz</Text>
        </View>

        {/* Exam Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sınav Tarihi</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={styles.pickerButton}
          >
            <Text style={styles.pickerValue}>
              {examDate ? formatDate(examDate) : 'Belirlenmedi'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <>
              <DateTimePicker
                value={examDate || tomorrow}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={tomorrow}
                onChange={(_, selectedDate) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (selectedDate) setExamDate(selectedDate);
                }}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.doneButton}
                >
                  <Text style={styles.doneText}>Tamam</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Daily Targets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Günlük Hedefler</Text>
          <View style={styles.targetRow}>
            <Text style={styles.targetLabel}>Hafta İçi</Text>
            <View style={styles.minutesRow}>
              <TextInput
                style={styles.minutesInput}
                value={weekdayMinutes}
                onChangeText={setWeekdayMinutes}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="120"
              />
              <Text style={styles.minutesSuffix}>min</Text>
            </View>
          </View>
          <View style={styles.targetRow}>
            <Text style={styles.targetLabel}>Hafta Sonu</Text>
            <View style={styles.minutesRow}>
              <TextInput
                style={styles.minutesInput}
                value={weekendMinutes}
                onChangeText={setWeekendMinutes}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="60"
              />
              <Text style={styles.minutesSuffix}>min</Text>
            </View>
          </View>
        </View>

        {/* Study Window */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Çalışma Penceresi</Text>
          <TimePickerField
            label="Başlangıç"
            value={studyStart}
            onChange={setStudyStart}
            showPicker={showStudyStartPicker}
            setShowPicker={setShowStudyStartPicker}
          />
          <TimePickerField
            label="Bitiş"
            value={studyEnd}
            onChange={setStudyEnd}
            showPicker={showStudyEndPicker}
            setShowPicker={setShowStudyEndPicker}
          />
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sessiz Saatler</Text>
          <TouchableOpacity
            onPress={() => setEnableQuietHours(!enableQuietHours)}
            style={styles.toggleRow}
          >
            <Text style={styles.toggleLabel}>Sessiz saatleri etkinleştir</Text>
            <View style={[styles.toggle, enableQuietHours && styles.toggleActive]}>
              <View
                style={[styles.toggleThumb, enableQuietHours && styles.toggleThumbActive]}
              />
            </View>
          </TouchableOpacity>
          {enableQuietHours && (
            <>
              <TimePickerField
                label="Başlangıç"
                value={quietStart}
                onChange={setQuietStart}
                showPicker={showQuietStartPicker}
                setShowPicker={setShowQuietStartPicker}
              />
              <TimePickerField
                label="Bitiş"
                value={quietEnd}
                onChange={setQuietEnd}
                showPicker={showQuietEndPicker}
                setShowPicker={setShowQuietEndPicker}
              />
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveButton, mutation.isPending && styles.buttonDisabled]}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Değişiklikleri Kaydet</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TimePickerField({
  label,
  value,
  onChange,
  showPicker,
  setShowPicker,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
}) {
  const handleChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate) onChange(selectedDate);
  };

  return (
    <View style={styles.timeField}>
      <TouchableOpacity
        onPress={() => setShowPicker(!showPicker)}
        style={styles.timeButton}
      >
        <Text style={styles.timeLabel}>{label}</Text>
        <Text style={styles.timeValue}>{formatTime(value)}</Text>
      </TouchableOpacity>
      {showPicker && (
        <>
          <DateTimePicker
            value={value}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            is24Hour={true}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              onPress={() => setShowPicker(false)}
              style={styles.doneButton}
            >
              <Text style={styles.doneText}>Tamam</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: { marginBottom: 24 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: { color: colors.primary[500], fontSize: 16, fontWeight: '500' },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.gray[900] },
  section: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[700],
    marginBottom: 12,
  },
  pickerButton: {
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  pickerValue: { fontSize: 16, color: colors.gray[900], fontWeight: '500' },
  doneButton: { alignItems: 'flex-end', paddingVertical: 4 },
  doneText: { color: colors.primary[500], fontSize: 16, fontWeight: '600' },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  targetLabel: { fontSize: 15, color: colors.gray[500], fontWeight: '500' },
  minutesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  minutesInput: {
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[900],
    width: 80,
    textAlign: 'center',
  },
  minutesSuffix: { fontSize: 14, color: colors.gray[500] },
  timeField: { marginBottom: 8 },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  timeLabel: { fontSize: 15, color: colors.gray[500], fontWeight: '500' },
  timeValue: { fontSize: 16, color: colors.gray[900], fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleLabel: { fontSize: 15, color: colors.gray[700], fontWeight: '500' },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray[300],
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: { backgroundColor: colors.primary[500] },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  nameInput: {
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    fontSize: 16,
    color: colors.gray[900],
    fontWeight: '500',
  },
  nameHint: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: colors.primary[500],
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: 'bold' },
  buttonDisabled: { opacity: 0.6 },
});
