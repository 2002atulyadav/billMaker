import type { Item, Unit } from '@/types';

/**
 * Turns a spoken (or typed) sentence into bill lines, e.g.
 *   "2 kg rice 60 rupees per kg and 1 litre milk 56"
 *   "दो किलो चावल साठ रुपये किलो और एक लीटर दूध छप्पन रुपये"
 *   "12 km" (matched to the saved "Per km fare" item)
 *
 * Speech recognisers usually write numbers as digits, but number words (English, Hindi, Hinglish)
 * are understood too. A spoken price is the rate per unit unless it's marked as a total ("total",
 * "कुल") or the quantity was in grams/ml, where people quote what the whole amount costs.
 * The result is always shown for review before it's added to a bill.
 */

export type VoiceLine = {
  description: string;
  qty: number;
  /** '' when nothing was said and no saved item matched */
  unit: Unit | '';
  /** rate per unit in paise; null when no price was said and no saved item matched */
  price_minor: number | null;
  /** the saved item this line was matched to */
  item_id: number | null;
};

type UnitWord = { unit: Unit; factor: number; afterNumberOnly?: boolean };

const U = (unit: Unit, words: string[], factor = 1, afterNumberOnly = false) =>
  words.map((w) => [w, { unit, factor, afterNumberOnly }] as const);

const UNIT_WORDS = new Map<string, UnitWord>([
  ...U('kg', ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'किलो', 'किलोग्राम', 'केजी']),
  ...U('kg', ['gm', 'gms', 'gram', 'grams', 'gramme', 'ग्राम'], 0.001),
  ...U('kg', ['g'], 0.001, true),
  ...U('ltr', ['ltr', 'litre', 'liter', 'litres', 'liters', 'लीटर', 'लिटर']),
  ...U('ltr', ['ml', 'mls', 'millilitre', 'milliliter', 'एमएल'], 0.001),
  ...U('ltr', ['l'], 1, true),
  ...U('km', ['km', 'kms', 'kilometre', 'kilometer', 'kilometres', 'kilometers', 'किमी', 'किलोमीटर']),
  ...U('mtr', ['mtr', 'mtrs', 'meter', 'metre', 'meters', 'metres', 'मीटर']),
  ...U('hr', ['hr', 'hrs', 'hour', 'hours', 'ghanta', 'ghante', 'ghanton', 'घंटा', 'घंटे', 'घंटों', 'घण्टा', 'घण्टे']),
  ...U('day', ['day', 'days', 'din', 'दिन', 'दिनों']),
  ...U('month', ['month', 'months', 'mahina', 'mahine', 'mahino', 'महीना', 'महीने', 'महीनों', 'माह']),
  ...U('trip', ['trip', 'trips', 'ट्रिप', 'chakkar', 'चक्कर', 'phera', 'phere', 'फेरा', 'फेरे']),
  ...U('visit', ['visit', 'visits', 'विज़िट', 'विजिट']),
  ...U('ton', ['ton', 'tons', 'tonne', 'tonnes', 'टन']),
  ...U('pcs', ['pc', 'pcs', 'piece', 'pieces', 'nag', 'नग', 'पीस']),
  ...U('pcs', ['dozen', 'dozens', 'darjan', 'दर्जन'], 12),
]);

/** Plain number words. Hindi has a distinct word for most numbers, so only common ones are listed; recognisers write the rest as digits. */
const NUMBER_WORDS = new Map<string, number>(
  Object.entries({
    // English
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
    eighty: 80, ninety: 90, half: 0.5,
    // Hinglish
    ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6, saat: 7,
    aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12, baarah: 12, terah: 13, chaudah: 14, pandrah: 15,
    solah: 16, satrah: 17, atharah: 18, unnis: 19, bees: 20, pachees: 25, pachchis: 25, tees: 30,
    chalis: 40, chaalis: 40, pachas: 50, pachaas: 50, saath: 60, sattar: 70, assi: 80, nabbe: 90,
    aadha: 0.5, aadhi: 0.5, adha: 0.5, dedh: 1.5, derh: 1.5, dhai: 2.5, dhaai: 2.5,
    // Devanagari
    'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8,
    'नौ': 9, 'दस': 10, 'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15, 'पन्द्रह': 15,
    'सोलह': 16, 'सत्रह': 17, 'अठारह': 18, 'उन्नीस': 19, 'बीस': 20, 'पच्चीस': 25, 'तीस': 30,
    'पैंतीस': 35, 'चालीस': 40, 'पैंतालीस': 45, 'पचास': 50, 'पचपन': 55, 'छप्पन': 56, 'साठ': 60,
    'पैंसठ': 65, 'सत्तर': 70, 'पचहत्तर': 75, 'अस्सी': 80, 'पचासी': 85, 'नब्बे': 90, 'पंचानवे': 95,
    'आधा': 0.5, 'आधी': 0.5, 'डेढ़': 1.5, 'डेढ': 1.5, 'ढाई': 2.5,
  }),
);

const MULTIPLIERS = new Map<string, number>(
  Object.entries({
    hundred: 100, thousand: 1000, lakh: 1e5, lakhs: 1e5, lac: 1e5, crore: 1e7,
    sau: 100, hazaar: 1000, hazar: 1000, hajar: 1000, karod: 1e7,
    'सौ': 100, 'हज़ार': 1000, 'हजार': 1000, 'लाख': 1e5, 'करोड़': 1e7, 'करोड': 1e7,
  }),
);

/** "saadhe teen" = 3.5, "sava do" = 2.25, "paune do" = 1.75 */
const MODIFIERS = new Map<string, number>(
  Object.entries({ sadhe: 0.5, saadhe: 0.5, sava: 0.25, savaa: 0.25, paune: -0.25, 'साढ़े': 0.5, 'साढे': 0.5, 'सवा': 0.25, 'पौने': -0.25 }),
);

const CURRENCY = new Set([
  '₹', 'rs', 'inr', 'rupee', 'rupees', 'rupay', 'rupaye', 'rupaiye', 'rupaya', 'rupiya', 'rupiye', 'rupe',
  'रुपये', 'रुपए', 'रूपये', 'रूपए', 'रुपया', 'रुपयों', 'रु',
]);
const PAISE = new Set(['paise', 'paisa', 'पैसे', 'पैसा']);
const PER = new Set(['per', 'prati', 'प्रति', 'har', 'हर', 'each', 'every', 'pe', 'पे', 'a', 'an', '/']);
/** Words that put the number after them in the price slot: "@ 60", "rate 60", "भाव 60". */
const RATE_MARK = new Set(['@', 'at', 'rate', 'रेट', 'bhav', 'भाव', 'daam', 'दाम']);
const TOTAL = new Set(['total', 'kul', 'कुल', 'milake', 'मिलाके', 'milakar', 'मिलाकर', 'overall']);
const SEPARATORS = ['and', 'aur', 'और', 'phir', 'फिर', 'then', 'plus', 'tatha', 'तथा'];
/** Dropped from the description. */
const FILLER = new Set([
  'ka', 'ki', 'ke', 'का', 'की', 'के', 'ko', 'को', 'of', 'for', 'the', 'is', 'se', 'से', 'me', 'mein', 'में',
  'wala', 'wali', 'wale', 'वाला', 'वाली', 'वाले', 'hisaab', 'hisab', 'हिसाब', 'add', 'likho', 'लिखो', 'jodo',
  'जोड़ो', 'dalo', 'डालो', 'only', 'sirf', 'सिर्फ', 'bas', 'बस', 'hai', 'है', 'hain', 'हैं',
]);
/** "दो किलो चावल दो" - a trailing "do/दो" is "give", not a number. */
const TRAILING_GIVE = new Set(['do', 'दो', 'de', 'दे', 'dena', 'देना', 'dijiye', 'दीजिए', 'दीजिये', 'chahiye', 'चाहिए']);

type Tok =
  | { k: 'num'; v: number; text: string }
  | { k: 'unit'; u: UnitWord; text: string }
  | { k: 'cur' | 'paise' | 'per' | 'rate' | 'total' | 'filler'; text: string }
  | { k: 'word'; text: string };

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

function normalise(text: string): string {
  return (
    text
      .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
      .toLowerCase()
      // 1,200 -> 1200 (a comma between words still separates lines)
      .replace(/(\d),(?=\d{2,3}\b)/g, '$1')
      // 60/- is how prices are written on paper
      .replace(/(\d)\s*\/-/g, '$1 ₹')
      .replace(/\brs\.?(?=\s*\d)/g, 'rs ')
      // a full stop ends a line, a decimal point doesn't
      .replace(/\./g, (m, at: number, s: string) => (/\d/.test(s[at - 1] ?? '') && /\d/.test(s[at + 1] ?? '') ? '.' : ','))
      .replace(/\//g, ' / ')
  );
}

const SEPARATOR_RE = new RegExp(`([,;।\\n]|\\s(?:${SEPARATORS.join('|')})\\s)`);

/** Splits on commas, full stops, the danda and spoken "and/aur/और/phir", keeping what separated each piece. */
function splitSegments(text: string): { text: string; sep: string }[] {
  const parts = text.split(SEPARATOR_RE);
  const out: { text: string; sep: string }[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const piece = parts[i].trim();
    if (piece) out.push({ text: piece, sep: (parts[i + 1] ?? '').trim() });
  }
  return out;
}

/** Lower-case Latin letters, digits and the Devanagari block (letters and vowel signs). */
const WORD_CHAR = 'a-z0-9\\u0900-\\u097F';

function tokenize(segment: string): Tok[] {
  const raw = segment.match(/\d+(?:\.\d+)?|₹|@|\/|[^\s\d₹@/]+/g) ?? [];
  const strip = new RegExp(`^[^${WORD_CHAR}₹@/]+|[^${WORD_CHAR}₹@/]+$`, 'g');
  const toks: Tok[] = [];
  for (const r of raw) {
    // Strip stray punctuation the recogniser may add ("rice?", "(2")
    const text = r.replace(strip, '');
    if (!text) continue;
    if (/^\d/.test(text)) toks.push({ k: 'num', v: Number(text), text });
    else if (NUMBER_WORDS.has(text)) toks.push({ k: 'num', v: NUMBER_WORDS.get(text)!, text });
    else if (UNIT_WORDS.has(text)) toks.push({ k: 'unit', u: UNIT_WORDS.get(text)!, text });
    else if (CURRENCY.has(text)) toks.push({ k: 'cur', text });
    else if (PAISE.has(text)) toks.push({ k: 'paise', text });
    else if (PER.has(text)) toks.push({ k: 'per', text });
    else if (RATE_MARK.has(text)) toks.push({ k: 'rate', text });
    else if (TOTAL.has(text)) toks.push({ k: 'total', text });
    else if (FILLER.has(text)) toks.push({ k: 'filler', text });
    else toks.push({ k: 'word', text });
  }
  return combineNumbers(toks);
}

/**
 * Merges number phrases into one number: "two hundred fifty" -> 250, "do hazaar paanch sau" -> 2500,
 * "2 hazaar" -> 2000, "saadhe teen" -> 3.5. Two plain numbers in a row stay separate ("2 60").
 */
function combineNumbers(toks: Tok[]): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < toks.length) {
    const start = i;
    let total = 0;
    let cur: number | null = null;
    let lastMult = Infinity;
    let wordTens = false;
    let pendingMod = 0;
    let used = false;
    while (i < toks.length) {
      const t = toks[i];
      const mod = t.k === 'word' ? MODIFIERS.get(t.text) : undefined;
      const mult = t.k === 'word' ? MULTIPLIERS.get(t.text) : undefined;
      if (mod !== undefined && cur === null && i + 1 < toks.length && toks[i + 1].k === 'num') {
        pendingMod = mod;
        i++;
        continue;
      }
      if (t.k === 'num') {
        const isWord = !/^\d/.test(t.text);
        if (cur === null) {
          cur = t.v + pendingMod;
          pendingMod = 0;
          wordTens = isWord && t.v >= 20 && t.v < 100 && t.v % 10 === 0;
        } else if (wordTens && isWord && t.v > 0 && t.v < 10) {
          // "twenty five"
          cur += t.v;
          wordTens = false;
        } else if (lastMult !== Infinity && cur % lastMult === 0 && t.v < lastMult && cur >= lastMult) {
          // "two hundred fifty", "2 hazaar 500"
          cur += t.v;
          wordTens = isWord && t.v >= 20 && t.v < 100 && t.v % 10 === 0;
        } else break;
        used = true;
        i++;
        continue;
      }
      if (mult !== undefined && (cur !== null || !used)) {
        if (mult >= 1000) {
          total += (cur ?? 1) * mult;
          cur = null;
        } else {
          cur = (cur ?? 1) * mult;
        }
        lastMult = mult;
        used = true;
        i++;
        continue;
      }
      break;
    }
    if (!used) {
      out.push(toks[start]);
      i = start + 1;
      continue;
    }
    const v = total + (cur ?? 0);
    out.push({ k: 'num', v, text: String(v) });
  }
  return out;
}

const NON_WORD = new RegExp(`[^${WORD_CHAR}]+`, 'g');
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(NON_WORD, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function wordsClose(a: string, b: string): boolean {
  if (a === b) return true;
  const len = Math.min(a.length, b.length);
  if (len < 4) return false;
  return editDistance(a, b) <= (len >= 7 ? 2 : 1);
}

/** Best saved item for a spoken description, or null. Tolerates small mis-hearings ("chawal" vs "chaawal"). */
export function matchItem(description: string, items: Item[]): Item | null {
  const d = norm(description);
  if (!d) return null;
  const dWords = d.split(' ');
  let best: Item | null = null;
  let bestScore = 0;
  for (const item of items) {
    const n = norm(item.name);
    if (!n) continue;
    const nWords = n.split(' ');
    let score = 0;
    if (n === d) score = 1;
    else if (d.length >= 3 && (n.includes(d) || d.includes(n))) score = 0.9;
    else {
      const hits = dWords.filter((w) => nWords.some((nw) => wordsClose(w, nw))).length;
      // Share of words matched on the longer side, so "rice" doesn't match "basmati rice premium" too eagerly
      score = (0.8 * hits) / Math.max(dWords.length, nWords.length);
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 0.4 ? best : null;
}

const toMinor = (rupees: number) => Math.round(rupees * 100);

function parseSegment(toks: Tok[], items: Item[]): VoiceLine | null {
  const used = new Set<number>();
  const at = (i: number) => (i >= 0 && i < toks.length && !used.has(i) ? toks[i] : undefined);
  const num = (i: number) => {
    const t = at(i);
    return t && t.k === 'num' ? t.v : undefined;
  };

  // A trailing "do / दो / dena" is a request ("give"), not the number two.
  const last = toks.length - 1;
  if (last > 0 && TRAILING_GIVE.has(toks[last].text) && toks.slice(0, last).some((t) => t.k === 'num')) used.add(last);

  // 1. Price: "60 rupees", "₹ 60", "@ 60", "rate 60", "60 per kg"
  let price: number | undefined;
  let priceEnd = -1;
  for (let i = 0; i < toks.length && price === undefined; i++) {
    const v = num(i);
    if (v !== undefined && at(i + 1)?.k === 'cur') {
      price = v;
      used.add(i).add(i + 1);
      priceEnd = i + 1;
    } else if (v !== undefined && at(i + 1)?.k === 'per' && at(i + 1)?.text !== 'a' && at(i + 1)?.text !== 'an') {
      price = v;
      used.add(i);
      priceEnd = i;
    } else if ((at(i)?.k === 'cur' || at(i)?.k === 'rate') && num(i + 1) !== undefined) {
      price = num(i + 1);
      used.add(i).add(i + 1);
      priceEnd = i + 1;
      if (at(i + 2)?.k === 'cur') {
        used.add(i + 2);
        priceEnd = i + 2;
      }
    }
  }
  // "... 60 rupees 50 paise"
  if (price !== undefined && num(priceEnd + 1) !== undefined && at(priceEnd + 2)?.k === 'paise') {
    price += num(priceEnd + 1)! / 100;
    used.add(priceEnd + 1).add(priceEnd + 2);
    priceEnd += 2;
  }

  // 2. Rate unit straight after the price: "60 rupees per kg", "60 रुपये किलो", "60 का एक किलो"
  let priceUnit: UnitWord | undefined;
  if (price !== undefined) {
    let j = priceEnd + 1;
    while (at(j)?.k === 'filler' || at(j)?.k === 'per' || num(j) === 1) j++;
    const t = at(j);
    if (t?.k === 'unit' && j - priceEnd <= 4) {
      priceUnit = t.u;
      for (let x = priceEnd + 1; x <= j; x++) used.add(x);
    }
  }
  // ...or anywhere: "per km 15"
  if (!priceUnit) {
    for (let i = 0; i < toks.length; i++) {
      const t = at(i + 1);
      if (at(i)?.k === 'per' && t?.k === 'unit') {
        priceUnit = t.u;
        used.add(i).add(i + 1);
        break;
      }
    }
  }

  // 3. Quantity: a number followed by a unit
  let qty: number | undefined;
  let qtyUnit: UnitWord | undefined;
  for (let i = 0; i < toks.length && qty === undefined; i++) {
    const v = num(i);
    const t = at(i + 1);
    if (v !== undefined && t?.k === 'unit') {
      qty = v;
      qtyUnit = t.u;
      used.add(i).add(i + 1);
    }
  }
  // A unit on its own ("kilo chawal 60") means one of it
  if (!qtyUnit) {
    const i = toks.findIndex((t, x) => !used.has(x) && t.k === 'unit' && !t.u.afterNumberOnly);
    if (i >= 0) {
      qtyUnit = (toks[i] as { u: UnitWord }).u;
      used.add(i);
    }
  }

  const isTotal = toks.some((t) => t.k === 'total');
  toks.forEach((t, i) => t.k === 'total' && used.add(i));

  // 4. Remaining bare numbers fill whichever of qty / price is still empty
  const bare: number[] = [];
  toks.forEach((t, i) => {
    if (!used.has(i) && t.k === 'num') {
      bare.push(t.v);
      used.add(i);
    }
  });

  const description = toks
    .filter((t, i) => !used.has(i) && (t.k === 'word' || t.k === 'num'))
    .map((t) => t.text)
    .join(' ')
    .trim();

  // Unnamed lines take the saved item with the same unit, if there's exactly one ("12 km" -> "Per km fare")
  let item = matchItem(description, items);
  if (!item && !description) {
    const unit = qtyUnit?.unit ?? priceUnit?.unit;
    const sameUnit = unit ? items.filter((it) => it.unit === unit) : [];
    if (sameUnit.length === 1) item = sameUnit[0];
  }

  if (qty === undefined && price === undefined && bare.length >= 2) {
    qty = bare.shift();
    price = bare.pop();
  } else if (qty === undefined && price !== undefined && bare.length) {
    qty = bare.shift();
  } else if (qty !== undefined && price === undefined && bare.length) {
    price = bare.shift();
  } else if (qty === undefined && price === undefined && bare.length === 1) {
    // One number: a quantity if the saved item already has a rate, else the price
    if (item && item.price_minor > 0) qty = bare[0];
    else price = bare[0];
  }

  if (!description && !item && qty === undefined && price === undefined) return null;

  const factor = qtyUnit?.factor ?? 1;
  const baseQty = (qty ?? 1) * factor;
  let rate: number | null = null;
  if (price !== undefined) {
    if (priceUnit) rate = price / priceUnit.factor;
    else if (isTotal || factor < 1) rate = baseQty > 0 ? price / baseQty : price;
    else if (factor > 1) rate = price / factor; // "2 dozen eggs 60" is 60 a dozen
    else rate = price;
  }

  const unit: Unit | '' = qtyUnit?.unit ?? priceUnit?.unit ?? item?.unit ?? '';
  const spoken = description.charAt(0).toUpperCase() + description.slice(1);
  return {
    description: item ? item.name : spoken,
    qty: Number(baseQty.toFixed(3)),
    unit,
    price_minor: rate !== null ? toMinor(rate) : item ? item.price_minor : null,
    item_id: item?.id ?? null,
  };
}

/** A numberless piece is its own line when it names a saved item that the next piece isn't also naming. */
function standsAlone(text: string, next: string, items: Item[]): boolean {
  const item = matchItem(text, items);
  if (!item) return false;
  const nextWords = tokenize(next)
    .filter((t) => t.k === 'word')
    .map((t) => t.text)
    .join(' ');
  return !nextWords || matchItem(nextWords, items)?.id !== item.id;
}

export function parseVoiceBill(transcript: string, items: Item[] = []): VoiceLine[] {
  const segments = splitSegments(normalise(transcript));

  // A piece without any number ("loading" in "loading and unloading 500") usually belongs to the next one,
  // unless it names a saved item on its own ("toll").
  const merged: Tok[][] = [];
  let carry = '';
  segments.forEach((seg, i) => {
    const text = carry ? `${carry} ${seg.text}` : seg.text;
    const toks = tokenize(text);
    const isLast = i === segments.length - 1;
    if (!isLast && !toks.some((t) => t.k === 'num') && !standsAlone(text, segments[i + 1].text, items)) {
      carry = /^[,;।]$/.test(seg.sep) ? text : `${text} ${seg.sep}`;
      return;
    }
    carry = '';
    merged.push(toks);
  });

  return merged.map((toks) => parseSegment(toks, items)).filter((l): l is VoiceLine => l !== null);
}
