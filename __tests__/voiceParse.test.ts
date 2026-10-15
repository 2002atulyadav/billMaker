import { matchItem, parseVoiceBill, type VoiceLine } from '@/lib/voiceParse';
import type { Item } from '@/types';

const items: Item[] = [
  { id: 1, name: 'Rice', price_minor: 6000, unit: 'kg' },
  { id: 2, name: 'Per km fare', price_minor: 1500, unit: 'km' },
  { id: 3, name: 'Toll / parking', price_minor: 10000, unit: 'other' },
  { id: 4, name: 'चावल', price_minor: 5500, unit: 'kg' },
  { id: 5, name: 'Loading / unloading', price_minor: 50000, unit: 'trip' },
  { id: 6, name: 'Waiting charge', price_minor: 10000, unit: 'hr' },
];

const line = (l: Partial<VoiceLine>): VoiceLine => ({
  description: '',
  qty: 1,
  unit: '',
  price_minor: null,
  item_id: null,
  ...l,
});

describe('parseVoiceBill: English', () => {
  it('reads quantity, unit and a per-unit price', () => {
    expect(parseVoiceBill('2 kg sugar 45 rupees per kg')).toEqual([
      line({ description: 'Sugar', qty: 2, unit: 'kg', price_minor: 4500 }),
    ]);
  });

  it('splits several items on "and" and commas', () => {
    expect(parseVoiceBill('2 kg sugar 45 rupees, 1 litre milk 56 and 3 soap 40')).toEqual([
      line({ description: 'Sugar', qty: 2, unit: 'kg', price_minor: 4500 }),
      line({ description: 'Milk', qty: 1, unit: 'ltr', price_minor: 5600 }),
      line({ description: 'Soap', qty: 3, price_minor: 4000 }),
    ]);
  });

  it('understands number words', () => {
    expect(parseVoiceBill('two hundred fifty grams paneer total eighty rupees')).toEqual([
      line({ description: 'Paneer', qty: 0.25, unit: 'kg', price_minor: 32000 }),
    ]);
    expect(parseVoiceBill('twenty five pieces bolt 3 rupees each')).toEqual([
      line({ description: 'Bolt', qty: 25, unit: 'pcs', price_minor: 300 }),
    ]);
  });

  it('treats a gram price as the cost of that amount', () => {
    expect(parseVoiceBill('500 gram cashew 450 rupees')).toEqual([
      line({ description: 'Cashew', qty: 0.5, unit: 'kg', price_minor: 90000 }),
    ]);
    // ...unless the rate is given per kg
    expect(parseVoiceBill('500 gram cashew 900 rupees per kg')).toEqual([
      line({ description: 'Cashew', qty: 0.5, unit: 'kg', price_minor: 90000 }),
    ]);
  });

  it('turns dozens into pieces at a per-dozen price', () => {
    expect(parseVoiceBill('2 dozen eggs 72 rupees')).toEqual([
      line({ description: 'Eggs', qty: 24, unit: 'pcs', price_minor: 600 }),
    ]);
  });

  it('uses "total" to split a price across the quantity', () => {
    expect(parseVoiceBill('3 kg onion total 90 rupees')).toEqual([
      line({ description: 'Onion', qty: 3, unit: 'kg', price_minor: 3000 }),
    ]);
  });

  it('reads written price forms', () => {
    expect(parseVoiceBill('notebook ₹40')[0]).toMatchObject({ description: 'Notebook', price_minor: 4000 });
    expect(parseVoiceBill('notebook Rs.40')[0]).toMatchObject({ description: 'Notebook', price_minor: 4000 });
    expect(parseVoiceBill('notebook 40/-')[0]).toMatchObject({ description: 'Notebook', price_minor: 4000 });
    expect(parseVoiceBill('pen 12.50 rupees')[0]).toMatchObject({ description: 'Pen', price_minor: 1250 });
    expect(parseVoiceBill('cloth 3 mtr @ 120')[0]).toMatchObject({ qty: 3, unit: 'mtr', price_minor: 12000 });
    expect(parseVoiceBill('paint 1,200 rupees')[0]).toMatchObject({ description: 'Paint', price_minor: 120000 });
    expect(parseVoiceBill('rice 60/kg')[0]).toMatchObject({ unit: 'kg', price_minor: 6000 });
  });

  it('takes two bare numbers as quantity then rate', () => {
    expect(parseVoiceBill('3 chai 10')).toEqual([line({ description: 'Chai', qty: 3, price_minor: 1000 })]);
    expect(parseVoiceBill('chai 10')).toEqual([line({ description: 'Chai', qty: 1, price_minor: 1000 })]);
  });

  it('keeps a full stop as a separator but not a decimal point', () => {
    expect(parseVoiceBill('2.5 kg apple 120 rupees. 1 kg banana 50 rupees')).toEqual([
      line({ description: 'Apple', qty: 2.5, unit: 'kg', price_minor: 12000 }),
      line({ description: 'Banana', qty: 1, unit: 'kg', price_minor: 5000 }),
    ]);
  });

  it('ignores empty input', () => {
    expect(parseVoiceBill('')).toEqual([]);
    expect(parseVoiceBill('  ,  and ')).toEqual([]);
  });
});

describe('parseVoiceBill: Hindi and Hinglish', () => {
  it('reads Devanagari words and digits', () => {
    expect(parseVoiceBill('दो किलो चीनी पैंतालीस रुपये किलो और एक लीटर दूध छप्पन रुपये')).toEqual([
      line({ description: 'चीनी', qty: 2, unit: 'kg', price_minor: 4500 }),
      line({ description: 'दूध', qty: 1, unit: 'ltr', price_minor: 5600 }),
    ]);
    expect(parseVoiceBill('२ किलो चीनी ४५ रुपये')).toEqual([
      line({ description: 'चीनी', qty: 2, unit: 'kg', price_minor: 4500 }),
    ]);
  });

  it('reads Hinglish', () => {
    expect(parseVoiceBill('do kilo aloo 30 rupaye kilo aur dedh kilo tamatar 40 rupaye')).toEqual([
      line({ description: 'Aloo', qty: 2, unit: 'kg', price_minor: 3000 }),
      line({ description: 'Tamatar', qty: 1.5, unit: 'kg', price_minor: 4000 }),
    ]);
  });

  it('combines Hindi number phrases', () => {
    expect(parseVoiceBill('सिलाई दो हज़ार पांच सौ रुपये')[0]).toMatchObject({ description: 'सिलाई', price_minor: 250000 });
    expect(parseVoiceBill('saadhe teen kilo atta')[0]).toMatchObject({ description: 'Atta', qty: 3.5, unit: 'kg' });
    expect(parseVoiceBill('पौने दो घंटे काम 300 रुपये')[0]).toMatchObject({ description: 'काम', qty: 1.75, unit: 'hr', price_minor: 30000 });
    expect(parseVoiceBill('mazdoori 2 hazaar rupaye')[0]).toMatchObject({ description: 'Mazdoori', price_minor: 200000 });
  });

  it('drops filler words and a trailing "give"', () => {
    expect(parseVoiceBill('दो किलो चावल वाला 50 रुपये का दो')).toEqual([
      line({ description: 'चावल', qty: 2, unit: 'kg', price_minor: 5000 }),
    ]);
  });

  it('reads Hindi trips, days and months', () => {
    expect(parseVoiceBill('3 चक्कर पुणे मुंबई 5000 रुपये')[0]).toMatchObject({ qty: 3, unit: 'trip', price_minor: 500000 });
    expect(parseVoiceBill('ek mahina fees 2000')[0]).toMatchObject({ description: 'Fees', qty: 1, unit: 'month', price_minor: 200000 });
  });
});

describe('parseVoiceBill: saved items', () => {
  it('uses the saved name, unit and rate', () => {
    expect(parseVoiceBill('3 kilo rice', items)).toEqual([
      line({ description: 'Rice', qty: 3, unit: 'kg', price_minor: 6000, item_id: 1 }),
    ]);
    expect(parseVoiceBill('2 किलो चावल', items)).toEqual([
      line({ description: 'चावल', qty: 2, unit: 'kg', price_minor: 5500, item_id: 4 }),
    ]);
  });

  it('a spoken rate beats the saved one', () => {
    expect(parseVoiceBill('3 kilo rice 70 rupees', items)[0]).toMatchObject({ item_id: 1, price_minor: 7000 });
  });

  it('a lone number is the quantity when the item has a rate', () => {
    expect(parseVoiceBill('waiting charge 2', items)[0]).toMatchObject({ item_id: 6, qty: 2, unit: 'hr', price_minor: 10000 });
  });

  it('fills an unnamed line from the only item with that unit', () => {
    expect(parseVoiceBill('120 km', items)).toEqual([
      line({ description: 'Per km fare', qty: 120, unit: 'km', price_minor: 1500, item_id: 2 }),
    ]);
  });

  it('keeps a numberless item as its own line', () => {
    expect(parseVoiceBill('120 km and toll', items)).toEqual([
      line({ description: 'Per km fare', qty: 120, unit: 'km', price_minor: 1500, item_id: 2 }),
      line({ description: 'Toll / parking', qty: 1, unit: 'other', price_minor: 10000, item_id: 3 }),
    ]);
  });

  it('joins a numberless piece onto the next one', () => {
    expect(parseVoiceBill('loading and unloading 2 trip', items)).toEqual([
      line({ description: 'Loading / unloading', qty: 2, unit: 'trip', price_minor: 50000, item_id: 5 }),
    ]);
    expect(parseVoiceBill('bread and butter 2 packet 60')).toEqual([
      line({ description: 'Bread and butter packet', qty: 2, price_minor: 6000 }),
    ]);
  });
});

describe('matchItem', () => {
  it('tolerates small mis-hearings', () => {
    expect(matchItem('wating charges', items)?.id).toBe(6);
    expect(matchItem('per kilometre fare', items)?.id).toBe(2);
  });

  it('returns null for unrelated words', () => {
    expect(matchItem('mobile cover', items)).toBeNull();
    expect(matchItem('', items)).toBeNull();
  });
});
