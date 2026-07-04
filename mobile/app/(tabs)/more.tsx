import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery } from '@tanstack/react-query';
import { fetchUnreadCount } from '../../src/api/coach';
import { colors, shadows, typography } from '../../src/ui/theme';

interface MenuItem {
  icon: string;
  label: string;
  route: string;
  badge?: number;
  color: string;
}

export default function MoreScreen() {
  const router = useRouter();
  const { data: unreadData } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30000,
  });

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Çalışma Araçları',
      items: [
        { icon: 'calendar', label: 'Takvim', route: '/calendar', color: '#8b5cf6' },
        { icon: 'sticky-note', label: 'Notlar', route: '/notes', color: colors.accent[500] },
        { icon: 'clock-o', label: 'Çalışma Oturumları', route: '/(tabs)/study', color: '#06b6d4' },
      ],
    },
    {
      title: 'Analitik',
      items: [
        { icon: 'bar-chart', label: 'İlerleme', route: '/(tabs)/progress', color: colors.success },
      ],
    },
    {
      title: 'İletişim',
      items: [
        {
          icon: 'inbox',
          label: 'Gelen Kutusu',
          route: '/(tabs)/inbox',
          badge: unreadData?.unread_count || 0,
          color: colors.info,
        },
      ],
    },
    {
      title: 'Hesap',
      items: [
        { icon: 'gear', label: 'Ayarlar', route: '/(tabs)/settings', color: colors.gray[500] },
        { icon: 'sliders', label: 'Tercihler', route: '/preferences', color: colors.primary[500] },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Daha Fazla</Text>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.row,
                    idx < section.items.length - 1 && styles.rowBorder,
                  ]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.iconCircle, { backgroundColor: item.color + '18' }]}>
                    <FontAwesome name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.badge != null && item.badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </Text>
                    </View>
                  )}
                  <FontAwesome name="chevron-right" size={14} color={colors.gray[300]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[100] },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.gray[900] },
  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.gray[900] },
  badge: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 4,
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
