import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../src/state/authStore';
import { useNotificationStore } from '../../src/state/notificationStore';
import { useThemeStore } from '../../src/state/themeStore';
import { updateProfile, fetchMe } from '../../src/api/auth';
import { fetchPreferences, updatePreferences } from '../../src/api/coach';
import { colors, typography, radius, shadows, useThemeColors, useIsDark } from '../../src/ui/theme';

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const c = useThemeColors();
  const isDark = useIsDark();

  // ─── Stores ────────────────────────────────────────────────
  const { user, token, setAuth, logout } = useAuthStore();
  const { clear: clearNotifications } = useNotificationStore();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

  // ─── Profile state ─────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [editingName, setEditingName] = useState(false);

  // ─── Preferences query ─────────────────────────────────────
  const { data: prefs } = useQuery({
    queryKey: ['preferences'],
    queryFn: fetchPreferences,
    retry: false,
  });

  // ─── Exam date state ───────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false);
  const examDate = prefs?.exam_date ? new Date(prefs.exam_date + 'T00:00:00') : null;

  useEffect(() => {
    if (user?.display_name) setDisplayName(user.display_name);
  }, [user?.display_name]);

  // ─── Mutations ─────────────────────────────────────────────
  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async (data) => {
      if (token) setAuth(token, data);
      setEditingName(false);
      Alert.alert('Başarılı', 'Profil güncellendi.');
    },
    onError: () => Alert.alert('Hata', 'Profil güncellenemedi.'),
  });

  const prefsMutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      queryClient.invalidateQueries({ queryKey: ['stats-summary'] });
    },
    onError: () => Alert.alert('Hata', 'Tercihler güncellenemedi.'),
  });

  const handleSaveName = () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert('Hata', 'İsim boş olamaz.');
      return;
    }
    profileMutation.mutate({ display_name: trimmed });
  };

  const handleExamDateChange = (_: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      prefsMutation.mutate({ exam_date: dateStr });
    }
  };

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: () => {
          clearNotifications();
          logout();
        },
      },
    ]);
  };

  const formatExamDate = (date: Date | null) => {
    if (!date) return 'Belirlenmedi';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const daysUntilExam = examDate
    ? Math.ceil((examDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // ─── Theme options ─────────────────────────────────────────
  const themeOptions: { value: 'light' | 'dark' | 'system'; label: string; icon: 'light-mode' | 'dark-mode' | 'settings-brightness' }[] = [
    { value: 'light', label: 'Açık', icon: 'light-mode' },
    { value: 'dark', label: 'Koyu', icon: 'dark-mode' },
    { value: 'system', label: 'Sistem', icon: 'settings-brightness' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.surface.main }]} edges={['top']}>
      {/* ─── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={c.primary.main} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.onSurface.main }]}>Ayarlar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ Profile Section ═══════════════════════════════ */}
        <View style={[styles.card, { backgroundColor: c.surface.containerLowest }]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="person" size={20} color={c.primary.main} />
            <Text style={[styles.cardTitle, { color: c.onSurface.main }]}>Profil</Text>
          </View>

          {/* Avatar + Email */}
          <View style={styles.profileRow}>
            <View style={[styles.avatarLarge, { backgroundColor: c.primary.container }]}>
              <Text style={[styles.avatarText, { color: c.primary.onContainer }]}>
                {(user?.display_name || user?.email || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: c.onSurface.main }]}>
                {user?.display_name || 'İsimsiz'}
              </Text>
              <Text style={[styles.profileEmail, { color: c.onSurface.variant }]}>
                {user?.email}
              </Text>
            </View>
          </View>

          {/* Edit Name */}
          <Text style={[styles.fieldLabel, { color: c.onSurface.variant }]}>İSİM</Text>
          {editingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.input, { backgroundColor: c.surface.containerLow, color: c.onSurface.main, borderColor: c.outline.variant }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Adınızı girin"
                placeholderTextColor={c.outline.main}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: c.primary.main }]}
                onPress={handleSaveName}
                disabled={profileMutation.isPending}
              >
                {profileMutation.isPending ? (
                  <ActivityIndicator size="small" color={c.primary.onPrimary} />
                ) : (
                  <MaterialIcons name="check" size={20} color={c.primary.onPrimary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: c.surface.containerHigh }]}
                onPress={() => { setEditingName(false); setDisplayName(user?.display_name || ''); }}
              >
                <MaterialIcons name="close" size={20} color={c.onSurface.variant} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.editableField, { backgroundColor: c.surface.containerLow, borderColor: c.outline.variant + '40' }]}
              onPress={() => setEditingName(true)}
            >
              <Text style={[styles.editableValue, { color: c.onSurface.main }]}>
                {user?.display_name || 'Düzenlemek için dokunun'}
              </Text>
              <MaterialIcons name="edit" size={18} color={c.outline.main} />
            </TouchableOpacity>
          )}

          {/* Exam Date */}
          <Text style={[styles.fieldLabel, { color: c.onSurface.variant, marginTop: 16 }]}>SINAV TARİHİ</Text>
          <TouchableOpacity
            style={[styles.editableField, { backgroundColor: c.surface.containerLow, borderColor: c.outline.variant + '40' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.editableValue, { color: c.onSurface.main }]}>
                {formatExamDate(examDate)}
              </Text>
              {daysUntilExam != null && daysUntilExam > 0 && (
                <Text style={[styles.daysLeft, { color: c.secondary.main }]}>
                  {daysUntilExam} gün kaldı
                </Text>
              )}
            </View>
            <MaterialIcons name="calendar-today" size={18} color={c.outline.main} />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={examDate || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={handleExamDateChange}
            />
          )}
        </View>

        {/* ═══ Theme Section ═════════════════════════════════ */}
        <View style={[styles.card, { backgroundColor: c.surface.containerLowest }]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="palette" size={20} color={c.primary.main} />
            <Text style={[styles.cardTitle, { color: c.onSurface.main }]}>Tema</Text>
          </View>
          <View style={styles.themeRow}>
            {themeOptions.map((opt) => {
              const isActive = themeMode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.themeOption,
                    { backgroundColor: c.surface.containerLow, borderColor: c.outline.variant + '40' },
                    isActive && { backgroundColor: c.primary.main, borderColor: c.primary.main },
                  ]}
                  onPress={() => setThemeMode(opt.value)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name={opt.icon} size={22} color={isActive ? c.primary.onPrimary : c.onSurface.variant} />
                  <Text style={[styles.themeLabel, { color: isActive ? c.primary.onPrimary : c.onSurface.variant }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ═══ Preferences Link ══════════════════════════════ */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: c.surface.containerLowest }]}
          onPress={() => router.push('/preferences')}
          activeOpacity={0.7}
        >
          <View style={styles.linkRow}>
            <View style={[styles.linkIcon, { backgroundColor: c.secondary.container }]}>
              <MaterialIcons name="tune" size={20} color={c.secondary.main} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkTitle, { color: c.onSurface.main }]}>Çalışma Tercihleri</Text>
              <Text style={[styles.linkHint, { color: c.onSurface.variant }]}>
                Günlük hedefler, çalışma penceresi, sessiz saatler
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={c.outline.main} />
          </View>
        </TouchableOpacity>

        {/* ═══ Logout ════════════════════════════════════════ */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: c.error.main + '40' }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <MaterialIcons name="logout" size={20} color={c.error.main} />
          <Text style={[styles.logoutText, { color: c.error.main }]}>Çıkış Yap</Text>
        </TouchableOpacity>

        {/* App version */}
        <Text style={[styles.version, { color: c.outline.main }]}>TusCoach v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Cards
  card: {
    borderRadius: radius['2xl'],
    padding: 20,
    marginBottom: 16,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },

  // Profile
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  avatarLarge: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: {
    fontSize: 22, fontWeight: '700',
  },
  profileName: {
    ...typography.bodyBold,
    fontSize: 17,
  },
  profileEmail: {
    ...typography.caption,
    marginTop: 2,
  },

  // Fields
  fieldLabel: {
    ...typography.labelWide,
    marginBottom: 8,
  },
  editableField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  editableValue: {
    ...typography.body,
  },
  daysLeft: {
    ...typography.tiny,
    marginTop: 2,
    fontWeight: '700',
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    ...typography.body,
  },
  saveBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  cancelBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
  },

  // Theme
  themeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Link row
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  linkIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  linkTitle: {
    ...typography.bodyBold,
  },
  linkHint: {
    ...typography.caption,
    marginTop: 2,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Version
  version: {
    textAlign: 'center',
    ...typography.caption,
    marginBottom: 20,
  },
});
