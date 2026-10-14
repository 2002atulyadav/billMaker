import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';

import { useProfile } from '@/hooks/use-profile';
import { useT } from '@/i18n/I18nProvider';

export default function TabsLayout() {
  const profile = useProfile();
  const { t } = useT();
  if (profile === undefined) return null;
  if (profile === null) return <Redirect href="/onboarding" />;

  return (
    <Tabs screenOptions={{ headerTitleStyle: { fontWeight: '600' } }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.bills'),
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: t('nav.clients'),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: t('nav.itemsTitle'),
          tabBarLabel: t('nav.items'),
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settingsTitle'),
          tabBarLabel: t('nav.settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
