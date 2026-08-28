import { DuplicateTracker } from './duplicate-tracker';

describe('DuplicateTracker', () => {
  describe('lookup / isDuplicate', () => {
    it('reports a fresh key as not a duplicate', () => {
      const tracker = new DuplicateTracker();
      const lookup = tracker.lookup('PROD-001');

      expect(lookup.duplicate).toBe(false);
      expect(lookup.reason).toBeUndefined();
      expect(tracker.isDuplicate('PROD-001')).toBe(false);
    });

    it('reports a pre-seeded existing key as an existing duplicate', () => {
      const tracker = new DuplicateTracker(['PROD-001']);
      const lookup = tracker.lookup('PROD-001');

      expect(lookup.duplicate).toBe(true);
      expect(lookup.reason).toBe('existing');
    });

    it('reports a key registered in this file as a file duplicate', () => {
      const tracker = new DuplicateTracker();
      tracker.register('PROD-001');

      const lookup = tracker.lookup('PROD-001');

      expect(lookup.duplicate).toBe(true);
      expect(lookup.reason).toBe('file');
    });

    it('reports a key that is both existing and seen as existing', () => {
      const tracker = new DuplicateTracker(['PROD-001']);
      tracker.register('PROD-001');

      const lookup = tracker.lookup('PROD-001');

      expect(lookup.duplicate).toBe(true);
      expect(lookup.reason).toBe('existing');
    });
  });

  describe('register', () => {
    it('returns true the first time a key is registered', () => {
      const tracker = new DuplicateTracker();
      expect(tracker.register('SKU-A')).toBe(true);
    });

    it('returns false when the key was already registered', () => {
      const tracker = new DuplicateTracker();
      tracker.register('SKU-A');
      expect(tracker.register('SKU-A')).toBe(false);
    });

    it('ignores empty keys without marking them seen', () => {
      const tracker = new DuplicateTracker();
      expect(tracker.register('')).toBe(false);
      expect(tracker.hasSeen('')).toBe(false);
    });
  });

  describe('hasExisting / hasSeen / seed', () => {
    it('distinguishes existing keys from seen-in-file keys', () => {
      const tracker = new DuplicateTracker(['DB-KEY']);
      tracker.register('FILE-KEY');

      expect(tracker.hasExisting('DB-KEY')).toBe(true);
      expect(tracker.hasSeen('DB-KEY')).toBe(false);

      expect(tracker.hasExisting('FILE-KEY')).toBe(false);
      expect(tracker.hasSeen('FILE-KEY')).toBe(true);
    });

    it('seeds additional existing keys after construction', () => {
      const tracker = new DuplicateTracker();
      tracker.seed('LATE-EXISTING');

      expect(tracker.hasExisting('LATE-EXISTING')).toBe(true);
      expect(tracker.isDuplicate('LATE-EXISTING')).toBe(true);
    });

    it('never treats an empty key as a duplicate', () => {
      const tracker = new DuplicateTracker(['']);
      expect(tracker.isDuplicate('')).toBe(false);
      expect(tracker.lookup('').duplicate).toBe(false);
    });
  });
});
