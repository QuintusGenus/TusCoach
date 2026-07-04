import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#004225',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <FontAwesome name="home" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <FontAwesome name="calendar-check-o" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: 'Sınavlar',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <FontAwesome name="line-chart" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Koç',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <FontAwesome name="commenting" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Daha Fazla',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <FontAwesome name="th-large" size={20} color={color} />
            </View>
          ),
        }}
      />
      {/* Hidden tabs — accessible via stack navigation from More */}
      <Tabs.Screen name="study" options={{ href: null }} />
      <Tabs.Screen name="inbox" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconWrap: {
    backgroundColor: '#e8f5ee',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    minWidth: 44,
  },
});
