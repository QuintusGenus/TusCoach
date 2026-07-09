import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColors, useIsDark } from '../../src/ui/theme';

export default function TabLayout() {
  const c = useThemeColors();
  const isDark = useIsDark();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary.main,
        tabBarInactiveTintColor: c.outline.main,
        tabBarStyle: {
          backgroundColor: isDark ? c.surface.containerLow : 'rgba(255,255,255,0.95)',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: 4,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.activeIconWrap, focused && { backgroundColor: isDark ? c.primary.container : c.surface.containerLow }]}>
              <MaterialIcons name="dashboard" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Program',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.activeIconWrap, focused && { backgroundColor: isDark ? c.primary.container : c.surface.containerLow }]}>
              <MaterialIcons name="calendar-today" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Analiz',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.activeIconWrap, focused && { backgroundColor: isDark ? c.primary.container : c.surface.containerLow }]}>
              <MaterialIcons name="insights" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Pratik',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.activeIconWrap, focused && { backgroundColor: isDark ? c.primary.container : c.surface.containerLow }]}>
              <MaterialIcons name="quiz" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'AI Chat',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.activeIconWrap, focused && { backgroundColor: isDark ? c.primary.container : c.surface.containerLow }]}>
              <MaterialIcons name="smart-toy" size={24} color={color} />
            </View>
          ),
        }}
      />
      {/* Hidden tabs — accessible via stack navigation */}
      <Tabs.Screen name="qbank_exam" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="exams" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="study" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="inbox" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="settings" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="messages" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="more" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="two" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="mastery_detail" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 36,
    borderRadius: 12,
  },
  activeIconWrap: {
    paddingHorizontal: 16,
    width: 56,
  },
});
