import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ClientFormModal } from '@/components/ClientFormModal';
import { Button, EmptyState, Fab, FAB_CLEARANCE, screenContent, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listClients, saveClient, type ClientSummary } from '@/db/repo';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import { formatMoney } from '@/lib/money';

export default function Clients() {
  const db = useSQLiteContext();
  const c = useTheme();
  const profile = useProfile();
  const { t } = useT();
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listClients(db).then(setClients);
    }, [db]),
  );

  const currency = profile?.currency ?? '₹';

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={clients ?? []}
        keyExtractor={(cl) => String(cl.id)}
        contentContainerStyle={[screenContent, { gap: Spacing.two, paddingBottom: FAB_CLEARANCE }]}
        ListEmptyComponent={
          clients === null ? null : (
            <EmptyState
              title={t('clients.empty')}
              message={t('clients.emptyHint')}
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/client/[id]', params: { id: String(item.id) } })}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontWeight: '600' }}>{item.name}</T>
              {item.phone ? <T muted style={{ fontSize: 13 }}>{item.phone}</T> : null}
              {item.due_minor > 0 ? (
                <T style={{ fontSize: 13, fontWeight: '600', color: c.warning }}>
                  {t('clients.due', { amount: formatMoney(item.due_minor, currency) })}
                </T>
              ) : null}
            </View>
            {item.unbilled_count ? (
              <View style={{ alignItems: 'flex-end' }}>
                <T style={{ fontWeight: '700' }}>{formatMoney(item.unbilled_minor, currency)}</T>
                <T muted style={{ fontSize: 12 }}>
                  {t('clients.unbilledCount', { count: item.unbilled_count })}
                </T>
              </View>
            ) : (
              <T muted style={{ fontSize: 13 }}>{t('clients.allBilled')}</T>
            )}
            <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
          </Pressable>
        )}
      />
      <Fab>
        <Button
          title={t('clients.add')}
          icon={<Ionicons name="person-add-outline" size={20} color={c.primaryText} />}
          onPress={() => setFormOpen(true)}
        />
      </Fab>
      <ClientFormModal
        visible={formOpen}
        client={null}
        onClose={() => setFormOpen(false)}
        onSave={async (cl) => {
          const id = await saveClient(db, cl);
          setFormOpen(false);
          router.push({ pathname: '/client/[id]', params: { id: String(id) } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
