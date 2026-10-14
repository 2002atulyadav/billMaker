import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { UNITS, type DetailField, type Lang, type Trade, type Unit } from '@/types';

/** `hi` is the item name used when the app is set up in Hindi. */
export type PresetItem = { name: string; hi: string; unit: Unit; price_minor: number };

/** Labels and hints are translated via the `trade.<trade>.label` / `.hint` keys. */
export type TradePreset = {
  trade: Trade;
  icon: ComponentProps<typeof Ionicons>['name'];
  billPrefix: string;
  /** Seeded into Items at onboarding so the first bill takes a few taps. Rates are typical starting points the user edits. */
  items: PresetItem[];
  /** Units offered in the item and entry forms, most common first. */
  units: Unit[];
  /** Extra fields on each work entry, printed as their own columns on period bills. */
  entryFields: DetailField[];
};

const ROUTE: DetailField[] = [
  { key: 'from', label: 'From', placeholder: 'e.g. Pune' },
  { key: 'to', label: 'To', placeholder: 'e.g. Mumbai' },
];

export const PRESETS: TradePreset[] = [
  {
    trade: 'transport',
    icon: 'bus-outline',
    billPrefix: 'TR-',
    units: ['trip', 'km', 'ton', 'day', 'month', 'hr', 'other'],
    entryFields: [...ROUTE, { key: 'vehicle', label: 'Vehicle no.', placeholder: 'e.g. MH12 AB 1234' }],
    items: [
      { name: 'Trip charge', hi: 'ट्रिप चार्ज', unit: 'trip', price_minor: 500000 },
      { name: 'Per km', hi: 'प्रति किमी', unit: 'km', price_minor: 4500 },
      { name: 'Per ton', hi: 'प्रति टन', unit: 'ton', price_minor: 150000 },
      { name: 'Loading / unloading', hi: 'लोडिंग / अनलोडिंग', unit: 'trip', price_minor: 50000 },
      { name: 'Detention charge', hi: 'रुकाई चार्ज', unit: 'day', price_minor: 200000 },
      { name: 'Monthly vehicle hire', hi: 'गाड़ी का मासिक किराया', unit: 'month', price_minor: 6000000 },
    ],
  },
  {
    trade: 'taxi',
    icon: 'car-outline',
    billPrefix: 'TX-',
    units: ['km', 'hr', 'trip', 'day', 'other'],
    entryFields: ROUTE,
    items: [
      { name: 'Per km fare', hi: 'प्रति किमी किराया', unit: 'km', price_minor: 1500 },
      { name: 'Waiting charge', hi: 'वेटिंग चार्ज', unit: 'hr', price_minor: 10000 },
      { name: 'Toll / parking', hi: 'टोल / पार्किंग', unit: 'other', price_minor: 10000 },
      { name: 'Driver allowance', hi: 'ड्राइवर भत्ता', unit: 'day', price_minor: 30000 },
      { name: 'Airport drop', hi: 'एयरपोर्ट ड्रॉप', unit: 'trip', price_minor: 80000 },
    ],
  },
  {
    trade: 'tutor',
    icon: 'school-outline',
    billPrefix: 'FEE-',
    units: ['month', 'hr', 'day', 'pcs', 'other'],
    entryFields: [{ key: 'student', label: 'Student', placeholder: 'Student name' }],
    items: [
      { name: 'Monthly fee', hi: 'मासिक फ़ीस', unit: 'month', price_minor: 200000 },
      { name: 'Single class', hi: 'एक क्लास', unit: 'hr', price_minor: 30000 },
      { name: 'Admission fee', hi: 'एडमिशन फ़ीस', unit: 'other', price_minor: 50000 },
      { name: 'Study material', hi: 'पढ़ाई की सामग्री', unit: 'pcs', price_minor: 20000 },
    ],
  },
  {
    trade: 'repair',
    icon: 'construct-outline',
    billPrefix: 'SR-',
    units: ['visit', 'hr', 'pcs', 'mtr', 'other'],
    entryFields: [{ key: 'site', label: 'Site', placeholder: 'Flat / building / area' }],
    items: [
      { name: 'Visit charge', hi: 'विज़िट चार्ज', unit: 'visit', price_minor: 20000 },
      { name: 'Labour', hi: 'मज़दूरी', unit: 'hr', price_minor: 30000 },
      { name: 'Spare part', hi: 'स्पेयर पार्ट', unit: 'pcs', price_minor: 10000 },
      { name: 'Wire / pipe', hi: 'तार / पाइप', unit: 'mtr', price_minor: 2000 },
    ],
  },
  {
    trade: 'tailor',
    icon: 'cut-outline',
    billPrefix: 'TL-',
    units: ['pcs', 'mtr', 'other'],
    entryFields: [],
    items: [
      { name: 'Shirt stitching', hi: 'शर्ट सिलाई', unit: 'pcs', price_minor: 40000 },
      { name: 'Pant stitching', hi: 'पैंट सिलाई', unit: 'pcs', price_minor: 45000 },
      { name: 'Blouse stitching', hi: 'ब्लाउज़ सिलाई', unit: 'pcs', price_minor: 50000 },
      { name: 'Alteration', hi: 'ऑल्टरेशन', unit: 'pcs', price_minor: 10000 },
    ],
  },
  {
    trade: 'freelancer',
    icon: 'laptop-outline',
    billPrefix: 'INV-',
    units: ['hr', 'day', 'month', 'other'],
    entryFields: [],
    items: [
      { name: 'Hourly work', hi: 'घंटे का काम', unit: 'hr', price_minor: 100000 },
      { name: 'Day rate', hi: 'दिन का रेट', unit: 'day', price_minor: 600000 },
      { name: 'Fixed project', hi: 'फ़िक्स प्रोजेक्ट', unit: 'other', price_minor: 1000000 },
    ],
  },
  {
    trade: 'shop',
    icon: 'storefront-outline',
    billPrefix: 'INV-',
    units: ['pcs', 'kg', 'ltr', 'mtr', 'other'],
    entryFields: [],
    // Every shop's catalogue is different, so start empty and let them add their own.
    items: [],
  },
  {
    trade: 'general',
    icon: 'briefcase-outline',
    billPrefix: 'INV-',
    units: [...UNITS],
    entryFields: [],
    items: [],
  },
];

export function presetItemName(item: PresetItem, lang: Lang): string {
  return lang === 'hi' ? item.hi : item.name;
}

export function presetFor(trade: Trade): TradePreset {
  return PRESETS.find((p) => p.trade === trade) ?? PRESETS[PRESETS.length - 1];
}

/** The trade's units, plus `current` if it isn't one of them (e.g. an item saved under a previous trade). */
export function unitsFor(trade: Trade, current?: string): Unit[] {
  const units = presetFor(trade).units;
  const extra = current && !units.includes(current as Unit) && (UNITS as readonly string[]).includes(current);
  return extra ? [...units, current as Unit] : units;
}
