import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';

import { useProfile } from '@/hooks/use-profile';

export default function TabsLayout() {
  const profile = useProfile();
  if (profile === undefined) return null;
  if (profile === null) return <Redirect href="/onboarding" />;

  return (
    <Tabs screenOptions={{ headerTitleStyle: { fontWeight: '600' } }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bills',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: 'Items & Rates',
          tabBarLabel: 'Items',
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Business profile',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
