import { getLocales } from 'expo-localization';

import { en, type TKey } from '@/i18n/en';
import { hi } from '@/i18n/hi';
import { LANGS, type BillLang, type Lang } from '@/types';

export type { TKey } from '@/i18n/en';

const DICTS: Record<Lang, Record<string, string>> = { en, hi };

/** Native names, so someone who can't read English can still find their language. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', hi: 'हिन्दी' };

export type Vars = Record<string, string | number>;

/** Keys that come in `_one` / `_other` pairs, e.g. 'common.entries'. */
export type PluralKey = { [K in TKey]: K extends `${infer B}_one` ? B : never }[TKey];

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function translate(lang: Lang, key: TKey, vars?: Vars): string {
  return interpolate(DICTS[lang][key] ?? en[key], vars);
}

/** Count-aware translate: picks `${key}_one` for 1, `${key}_other` otherwise, and fills {{count}}. */
export function translateCount(lang: Lang, key: PluralKey, count: number, vars?: Vars): string {
  const full = `${key}_${count === 1 ? 'one' : 'other'}` as TKey;
  return translate(lang, full, { count, ...vars });
}

/** For keys built at runtime (units, trade fields): falls back to `fallback` when there's no translation. */
export function translateDynamic(lang: Lang, key: string, fallback: string): string {
  return DICTS[lang][key] ?? fallback;
}

export type Translator = {
  lang: Lang;
  t: (key: TKey, vars?: Vars) => string;
  tn: (key: PluralKey, count: number, vars?: Vars) => string;
  /** unit code -> display name ("pcs" -> "नग") */
  unit: (unit: string) => string;
  /** runtime-built key (e.g. `field.${key}`), or `fallback` when untranslated */
  dyn: (key: string, fallback: string) => string;
};

export function makeTranslator(lang: Lang): Translator {
  return {
    lang,
    t: (key, vars) => translate(lang, key, vars),
    tn: (key, count, vars) => translateCount(lang, key, count, vars),
    unit: (u) => (u ? translateDynamic(lang, `unit.${u}`, u) : ''),
    dyn: (key, fallback) => translateDynamic(lang, key, fallback),
  };
}

/**
 * Translator for printed bills. 'both' joins English and Hindi ("Total / कुल") so one bill works for
 * an English-reading company and a Hindi-reading owner. Identical strings aren't doubled.
 */
export function makeBillTranslator(billLang: BillLang): Translator {
  if (billLang !== 'both') return makeTranslator(billLang);
  const e = makeTranslator('en');
  const h = makeTranslator('hi');
  const join = (a: string, b: string) => (a === b ? a : `${a} / ${b}`);
  return {
    // Dates, months and messages read in English; only labels are doubled.
    lang: 'en',
    t: (key, vars) => join(e.t(key, vars), h.t(key, vars)),
    tn: (key, count, vars) => join(e.tn(key, count, vars), h.tn(key, count, vars)),
    unit: (u) => join(e.unit(u), h.unit(u)),
    dyn: (key, fallback) => join(e.dyn(key, fallback), h.dyn(key, fallback)),
  };
}

export function isLang(x: unknown): x is Lang {
  return (LANGS as readonly unknown[]).includes(x);
}

/** Device language if we support it, else English. */
export function deviceLang(): Lang {
  for (const l of getLocales()) if (isLang(l.languageCode)) return l.languageCode;
  return 'en';
}
