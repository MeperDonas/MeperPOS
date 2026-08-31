import { computeSkipTake } from './pagination';

// Parity baseline: this helper is a drop-in replacement for the inline
// `const skip = (page - 1) * limit;` + `take: limit` pattern previously
// duplicated in products.service.findAll and sales.service.findAll.
// It must reproduce that formula EXACTLY for every input — including
// out-of-range pages and zero limits — with NO clamping.
describe('computeSkipTake', () => {
  const parityCases: Array<[number, number]> = [
    [1, 10], // first page, default page size
    [2, 20], // representative matrix case
    [2, 10],
    [3, 10],
    [5, 25],
    [10, 10],
    [100, 50], // deep page
    [1, 1],
    [1, 100],
  ];

  it.each(parityCases)(
    'matches the inline (page - 1) * limit formula for page=%i limit=%i',
    (page, limit) => {
      expect(computeSkipTake(page, limit)).toEqual({
        skip: (page - 1) * limit,
        take: limit,
      });
    },
  );

  it('does not clamp out-of-range inputs (exact parity with raw arithmetic)', () => {
    expect(computeSkipTake(0, 10)).toEqual({ skip: -10, take: 10 });
    expect(computeSkipTake(-1, 10)).toEqual({ skip: -20, take: 10 });
    expect(computeSkipTake(999, 10)).toEqual({ skip: 9980, take: 10 });
    expect(computeSkipTake(2, 0)).toEqual({ skip: 0, take: 0 });
  });

  it('keeps parity on a deterministic pseudo-random sweep', () => {
    // LCG keeps the sweep reproducible; the parity contract is checked
    // against the inline computation, not hardcoded expectations.
    let state = 42;
    const next = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };

    for (let i = 0; i < 100; i += 1) {
      const page = Math.floor(next() * 500); // 0..499 — includes 0 on purpose
      const limit = Math.floor(next() * 100) + 1; // 1..100

      expect(computeSkipTake(page, limit)).toEqual({
        skip: (page - 1) * limit,
        take: limit,
      });
    }
  });
});
