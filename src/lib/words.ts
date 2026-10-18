import type { Lang } from '@/types';

/**
 * Amounts in words, the Indian way (thousand, lakh, crore), as printed on a traditional bill:
 * 1035025 paise -> "Ten thousand three hundred fifty rupees and twenty five paise only".
 */

const EN_ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Hindi has a distinct word for every number up to 99. */
const HI_1_99 = (
  'शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस ' +
  'इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस ' +
  'सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास ' +
  'इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ ' +
  'अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी ' +
  'बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे ' +
  'सत्तानवे अट्ठानवे निन्यानवे'
).split(' ');

const SCALES: Record<Lang, { crore: string; lakh: string; thousand: string; hundred: string }> = {
  en: { crore: 'crore', lakh: 'lakh', thousand: 'thousand', hundred: 'hundred' },
  hi: { crore: 'करोड़', lakh: 'लाख', thousand: 'हज़ार', hundred: 'सौ' },
};

function below100(n: number, lang: Lang): string {
  if (lang === 'hi') return HI_1_99[n];
  if (n < 20) return EN_ONES[n];
  return [EN_TENS[Math.floor(n / 10)], n % 10 ? EN_ONES[n % 10] : ''].filter(Boolean).join(' ');
}

/** Whole number in words using Indian grouping; larger amounts repeat "crore" (100 crore = "one hundred crore"). */
export function numberInWords(n: number, lang: Lang = 'en'): string {
  if (!Number.isFinite(n) || n < 0) return '';
  n = Math.floor(n);
  if (n === 0) return below100(0, lang);
  const s = SCALES[lang];
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  if (crore) parts.push(`${numberInWords(crore, lang)} ${s.crore}`);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  if (lakh) parts.push(`${below100(lakh, lang)} ${s.lakh}`);
  n %= 1e5;
  const thousand = Math.floor(n / 1000);
  if (thousand) parts.push(`${below100(thousand, lang)} ${s.thousand}`);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  if (hundred) parts.push(`${below100(hundred, lang)} ${s.hundred}`);
  n %= 100;
  if (n) parts.push(below100(n, lang));
  return parts.join(' ');
}

/** Rupees and paise in words, ending in "only" / "मात्र". */
export function amountInWords(minor: number, lang: Lang = 'en'): string {
  const rupees = Math.floor(Math.max(0, minor) / 100);
  const paise = Math.max(0, minor) % 100;
  if (lang === 'hi') {
    const r = `${numberInWords(rupees, 'hi')} ${rupees === 1 ? 'रुपया' : 'रुपये'}`;
    return paise ? `${r} और ${numberInWords(paise, 'hi')} पैसे मात्र` : `${r} मात्र`;
  }
  const r = `${numberInWords(rupees, 'en')} ${rupees === 1 ? 'rupee' : 'rupees'}`;
  const text = paise ? `${r} and ${numberInWords(paise, 'en')} paise only` : `${r} only`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
