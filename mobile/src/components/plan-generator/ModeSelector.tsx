import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { usePlanGeneratorStore } from '../../state/planGeneratorStore';
import { typography, radius, shadows, useThemeColors } from '../../ui/theme';

export function ModeSelector() {
  const c = useThemeColors();
  const setMode = usePlanGeneratorStore((s) => s.setMode);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="auto-awesome" size={32} color={c.primary.main} />
        <Text style={[styles.title, { color: c.onSurface.main }]}>Çalışma Planı Oluştur</Text>
        <Text style={[styles.subtitle, { color: c.onSurface.variant }]}>
          TUS sınavına özel kişiselleştirilmiş çalışma planınızı oluşturun.
        </Text>
      </View>

      {/* Generate for me */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: c.primary.container }]}
        onPress={() => setMode('wizard')}
        activeOpacity={0.8}
      >
        <View style={[styles.cardIcon, { backgroundColor: c.primary.main }]}>
          <MaterialIcons name="auto-fix-high" size={28} color={c.primary.onPrimary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: c.primary.onContainer }]}>Benim İçin Oluştur</Text>
          <Text style={[styles.cardDescription, { color: c.primary.onContainer }]}>
            Birkaç soru cevapla, sana uygun planı oluşturalım. Hızlı ve kolay.
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={c.primary.onContainer} />
      </TouchableOpacity>

      {/* Builder mode */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: c.surface.containerLowest, borderWidth: 1, borderColor: c.outline.variant + '40' }]}
        onPress={() => setMode('builder')}
        activeOpacity={0.8}
      >
        <View style={[styles.cardIcon, { backgroundColor: c.secondary.container }]}>
          <MaterialIcons name="tune" size={28} color={c.secondary.main} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: c.onSurface.main }]}>Kendim Kurayım</Text>
          <Text style={[styles.cardDescription, { color: c.onSurface.variant }]}>
            Tüm detayları kendin ayarla. Çalışma saatleri, ders dağılımı ve daha fazlası.
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={c.outline.main} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: radius['2xl'],
    gap: 14,
    ...shadows.md,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  cardDescription: {
    ...typography.caption,
    lineHeight: 18,
  },
});
