import { likePattern } from '@/db/repo';

describe('likePattern', () => {
  it('wraps the trimmed search in wildcards', () => {
    expect(likePattern('  asha ')).toBe('%asha%');
  });
  it('escapes LIKE wildcards and the escape char', () => {
    expect(likePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });
});
