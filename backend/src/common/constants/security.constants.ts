/**
 * Shared security constants.
 *
 * BCRYPT_ROUNDS is the single source of truth for the bcrypt cost factor
 * used whenever a password hash is created. Verification auto-detects the
 * cost embedded in each hash, so raising this value keeps existing hashes
 * valid; they are upgraded to the new cost the next time a user sets a
 * new password.
 */
export const BCRYPT_ROUNDS = 12;
