import { amountInWords, numberInWords } from '@/lib/words';

describe('numberInWords (Indian grouping)', () => {
  it.each([
    [0, 'zero'], [1, 'one'], [15, 'fifteen'], [20, 'twenty'], [99, 'ninety nine'], [100, 'one hundred'],
    [105, 'one hundred five'], [1000, 'one thousand'], [10350, 'ten thousand three hundred fifty'],
    [100000, 'one lakh'], [250000, 'two lakh fifty thousand'], [1000000, 'ten lakh'],
    [10035025, 'one crore thirty five thousand twenty five'], [123456789, 'twelve crore thirty four lakh fifty six thousand seven hundred eighty nine'],
    [1000000000, 'one hundred crore'],
  ])('%d -> %s', (n, words) => expect(numberInWords(n)).toBe(words));

  it('speaks Hindi with its own word for every number up to 99', () => {
    expect(numberInWords(0, 'hi')).toBe('शून्य');
    expect(numberInWords(56, 'hi')).toBe('छप्पन');
    expect(numberInWords(99, 'hi')).toBe('निन्यानवे');
    expect(numberInWords(10350, 'hi')).toBe('दस हज़ार तीन सौ पचास');
    expect(numberInWords(2500000, 'hi')).toBe('पच्चीस लाख');
    expect(numberInWords(30000000, 'hi')).toBe('तीन करोड़');
  });
});

describe('amountInWords', () => {
  it('reads rupees and paise', () => {
    expect(amountInWords(1035000)).toBe('Ten thousand three hundred fifty rupees only');
    expect(amountInWords(1035025)).toBe('Ten thousand three hundred fifty rupees and twenty five paise only');
    expect(amountInWords(100)).toBe('One rupee only');
    expect(amountInWords(0)).toBe('Zero rupees only');
    expect(amountInWords(50)).toBe('Zero rupees and fifty paise only');
  });

  it('reads Hindi', () => {
    expect(amountInWords(1035000, 'hi')).toBe('दस हज़ार तीन सौ पचास रुपये मात्र');
    expect(amountInWords(1035025, 'hi')).toBe('दस हज़ार तीन सौ पचास रुपये और पच्चीस पैसे मात्र');
    expect(amountInWords(100, 'hi')).toBe('एक रुपया मात्र');
  });
});
