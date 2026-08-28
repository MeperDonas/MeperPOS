/**
 * Tracks the lookup keys that identify a single importable record (e.g. a
 * product SKU, a customer/supplier document number, or a user email) so the
 * engine can reject duplicates both against records already present in the
 * database and against rows seen earlier in the same file.
 *
 * A handler owns one or more trackers for the duration of a single import job
 * (the orchestrator constructs handlers per job, so no state leaks between
 * imports). {@link seed} registers keys that already exist in the database;
 * {@link register} marks a key as seen in the current file.
 */
export type DuplicateReason = 'existing' | 'file';

export interface DuplicateLookup {
  /** The key that was checked. */
  key: string;
  /** Whether the key collides with an existing or already-seen key. */
  duplicate: boolean;
  /** Why the key is considered a duplicate, when it is. */
  reason?: DuplicateReason;
}

export class DuplicateTracker {
  private readonly existingKeys: Set<string>;
  private readonly seenKeys = new Set<string>();

  constructor(existingKeys: Iterable<string> = []) {
    this.existingKeys = new Set(existingKeys);
  }

  /** Registers a database-existing key that must never be re-imported. */
  seed(key: string): void {
    if (key) {
      this.existingKeys.add(key);
    }
  }

  /** True when the key is known to already exist in the database. */
  hasExisting(key: string): boolean {
    return !!key && this.existingKeys.has(key);
  }

  /** True when the key was already seen in the current file. */
  hasSeen(key: string): boolean {
    return !!key && this.seenKeys.has(key);
  }

  /**
   * Returns the duplicate verdict for a key: an `existing` duplicate when the
   * key is already in the database, a `file` duplicate when it was seen earlier
   * in this file, or a non-duplicate otherwise.
   */
  lookup(key: string): DuplicateLookup {
    if (!key) {
      return { key, duplicate: false };
    }

    if (this.existingKeys.has(key)) {
      return { key, duplicate: true, reason: 'existing' };
    }

    if (this.seenKeys.has(key)) {
      return { key, duplicate: true, reason: 'file' };
    }

    return { key, duplicate: false };
  }

  /** True when the key is an existing or already-seen duplicate. */
  isDuplicate(key: string): boolean {
    return this.lookup(key).duplicate;
  }

  /**
   * Marks a key as seen in the current file. Returns `true` when the key was
   * newly registered and `false` when it was already seen (or empty).
   */
  register(key: string): boolean {
    if (!key) {
      return false;
    }

    if (this.seenKeys.has(key)) {
      return false;
    }

    this.seenKeys.add(key);
    return true;
  }
}
