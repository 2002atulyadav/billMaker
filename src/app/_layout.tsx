import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { DATABASE_NAME, migrate } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { I18nProvider, useT } from '@/i18n/I18nProvider';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: c.primary, background: c.background, card: c.card, text: c.text, border: c.border },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="auto" />
      <Suspense
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
            <ActivityIndicator />
          </View>
        }>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate} useSuspense>
          <I18nProvider>
            <AppStack />
          </I18nProvider>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}

function AppStack() {
  const { t } = useT();
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontWeight: '600' } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="onboarding"
        options={{ title: t('nav.onboarding'), headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen name="bill/new" options={{ title: t('nav.newBill') }} />
      <Stack.Screen name="bill/[id]" options={{ title: t('nav.bill') }} />
      <Stack.Screen name="client/[id]" options={{ title: t('nav.client') }} />
    </Stack>
  );
}
