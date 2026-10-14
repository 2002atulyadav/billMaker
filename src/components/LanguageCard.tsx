import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { Card, Chip, Row, SectionTitle, T } from '@/components/ui';
import { setBillLanguage } from '@/db/repo';
import { LANG_NAMES } from '@/i18n';
import { useT } from '@/i18n/I18nProvider';
import { LANGS, type BillLang } from '@/types';

/** App language and, separately, the language printed on bills (an owner may read Hindi but bill a company in English). */
export function LanguageCard({ billLanguage: initial }: { billLanguage: BillLang }) {
  const db = useSQLiteContext();
  const { t, lang, setLang } = useT();
  const [billLang, setBillLang] = useState<BillLang>(initial);

  async function chooseBillLang(next: BillLang) {
    setBillLang(next);
    await setBillLanguage(db, next);
  }

  return (
    <Card>
      <SectionTitle>{t('lang.appLanguage')}</SectionTitle>
      <Row style={{ flexWrap: 'wrap' }}>
        {LANGS.map((l) => (
          <Chip key={l} label={LANG_NAMES[l]} selected={lang === l} onPress={() => setLang(l)} />
        ))}
      </Row>
      <SectionTitle>{t('lang.billLanguage')}</SectionTitle>
      <Row style={{ flexWrap: 'wrap' }}>
        {LANGS.map((l) => (
          <Chip key={l} label={LANG_NAMES[l]} selected={billLang === l} onPress={() => chooseBillLang(l)} />
        ))}
        <Chip label={t('lang.both')} selected={billLang === 'both'} onPress={() => chooseBillLang('both')} />
      </Row>
      <T muted style={{ fontSize: 12 }}>{t('lang.billHint')}</T>
    </Card>
  );
}
