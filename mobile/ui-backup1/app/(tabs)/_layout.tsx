import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#004225' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome name="list-alt" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: 'Sınavlar',
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome name="line-chart" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Koç',
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome name="comment" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Daha Fazla',
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome name="ellipsis-h" size={24} color={color} />,
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
