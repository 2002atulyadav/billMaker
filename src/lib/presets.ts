import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { Trade, Unit } from '@/types';

export type PresetItem = { name: string; unit: Unit; price_minor: number };

export type TradePreset = {
  trade: Trade;
  label: string;
  /** who this is for, shown under the label */
  hint: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  billPrefix: string;
  /** Seeded into Items at onboarding so the first bill takes a few taps. Rates are typical starting points the user edits. */
  items: PresetItem[];
};

export const PRESETS: TradePreset[] = [
  {
    trade: 'taxi',
    label: 'Taxi / Auto',
    hint: 'Cab, auto, tempo, travels',
    icon: 'car-outline',
    billPrefix: 'TX-',
    items: [
      { name: 'Per km fare', unit: 'km', price_minor: 1500 },
      { name: 'Waiting charge', unit: 'hr', price_minor: 10000 },
      { name: 'Toll / parking', unit: 'other', price_minor: 10000 },
      { name: 'Driver allowance', unit: 'day', price_minor: 30000 },
      { name: 'Airport drop', unit: 'trip', price_minor: 80000 },
    ],
  },
  {
    trade: 'tutor',
    label: 'Tutor / Coaching',
    hint: 'Tuition, music, yoga, gym',
    icon: 'school-outline',
    billPrefix: 'FEE-',
    items: [
      { name: 'Monthly fee', unit: 'month', price_minor: 200000 },
      { name: 'Single class', unit: 'hr', price_minor: 30000 },
      { name: 'Admission fee', unit: 'other', price_minor: 50000 },
      { name: 'Study material', unit: 'pcs', price_minor: 20000 },
    ],
  },
  {
    trade: 'repair',
    label: 'Repair & Services',
    hint: 'Electrician, plumber, AC, mobile',
    icon: 'construct-outline',
    billPrefix: 'SR-',
    items: [
      { name: 'Visit charge', unit: 'visit', price_minor: 20000 },
      { name: 'Labour', unit: 'hr', price_minor: 30000 },
      { name: 'Spare part', unit: 'pcs', price_minor: 10000 },
      { name: 'Wire / pipe', unit: 'mtr', price_minor: 2000 },
    ],
  },
  {
    trade: 'tailor',
    label: 'Tailor / Boutique',
    hint: 'Stitching, alteration',
    icon: 'cut-outline',
    billPrefix: 'TL-',
    items: [
      { name: 'Shirt stitching', unit: 'pcs', price_minor: 40000 },
      { name: 'Pant stitching', unit: 'pcs', price_minor: 45000 },
      { name: 'Blouse stitching', unit: 'pcs', price_minor: 50000 },
      { name: 'Alteration', unit: 'pcs', price_minor: 10000 },
    ],
  },
  {
    trade: 'freelancer',
    label: 'Freelancer',
    hint: 'Design, photography, consulting',
    icon: 'laptop-outline',
    billPrefix: 'INV-',
    items: [
      { name: 'Hourly work', unit: 'hr', price_minor: 100000 },
      { name: 'Day rate', unit: 'day', price_minor: 600000 },
      { name: 'Fixed project', unit: 'other', price_minor: 1000000 },
    ],
  },
  {
    trade: 'shop',
    label: 'Shop / Vendor',
    hint: 'Kirana, stall, wholesale',
    icon: 'storefront-outline',
    billPrefix: 'INV-',
    // Every shop's catalogue is different, so start empty and let them add their own.
    items: [],
  },
  {
    trade: 'general',
    label: 'Something else',
    hint: 'Start with a blank item list',
    icon: 'briefcase-outline',
    billPrefix: 'INV-',
    items: [],
  },
];

export function presetFor(trade: Trade): TradePreset {
  return PRESETS.find((p) => p.trade === trade) ?? PRESETS[PRESETS.length - 1];
}
