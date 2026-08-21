/**
 * Minimum accepted length for the JWT signing secret.
 */
export const JWT_SECRET_MIN_LENGTH = 32;

/**
 * Validates the runtime environment before the application boots.
 *
 * Production requires an explicitly configured JWT_SECRET of at least
 * `JWT_SECRET_MIN_LENGTH` characters; a missing or weak secret aborts startup
 * so a misconfigured deploy fails fast instead of serving tokens signed with
 * an insecure key. Non-production environments only log a warning to keep
 * local development friction low.
 */
export function validateJwtSecretOrExit(env: NodeJS.ProcessEnv): void {
  const secret = env.JWT_SECRET;
  const isProduction = env.NODE_ENV === 'production';

  if (!secret || secret.length < JWT_SECRET_MIN_LENGTH) {
    if (!isProduction) {
      console.warn(
        `[runtime-env] JWT_SECRET is missing or shorter than ${JWT_SECRET_MIN_LENGTH} characters; set a strong secret before deploying.`,
      );
      return;
    }

    console.error(
      `[runtime-env] Refusing to start: production requires a JWT_SECRET of at least ${JWT_SECRET_MIN_LENGTH} characters.`,
    );
    process.exit(1);
  }
}
