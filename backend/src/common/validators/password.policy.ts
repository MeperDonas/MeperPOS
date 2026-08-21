import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

/**
 * Password policy (issue #48, Slice B).
 *
 * Modern NIST guidance: length plus a denylist of breached/common
 * passwords beats composition-rule theater. No uppercase/digit/symbol
 * requirements are enforced on purpose.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Embedded denylist of the most common leaked passwords. Comparison is
 * done against the lowercased password. Short entries are kept for
 * defense in depth even though the minimum length already rejects them.
 */
export const COMMON_PASSWORDS: readonly string[] = [
  // Numeric sequences
  '123456',
  '123456789',
  '12345678',
  '1234567',
  '1234567890',
  '000000',
  '111111',
  '121212',
  '123123',
  '112233',
  // More numeric patterns
  '654321',
  '666666',
  '696969',
  '123321',
  '159753',
  '987654321',
  '102030',
  '1234321',
  '147258369',
  '1123581321',
  // Keyboard walks
  'qwerty',
  'qwertyuiop',
  'qazwsx',
  'qazwsxedc',
  'zaq12wsx',
  '1q2w3e4r',
  '1q2w3e4r5t',
  '1qaz2wsx',
  'asdfgh',
  'zxcvbnm',
  // Classic passwords and variants
  'abc123',
  'abc123456',
  'iloveyou',
  'iloveu',
  'password',
  'password1',
  'password123',
  'passw0rd',
  'p@ssw0rd',
  'passwd',
  // Administrative defaults
  'admin',
  'admin123',
  'administrator',
  'root',
  'toor',
  'guest',
  'test',
  'welcome',
  'welcome1',
  'welcome123',
  'letmein',
  // Common dictionary choices
  'login',
  'monkey',
  'dragon',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'basketball',
  'soccer',
  'hockey',
  'master',
  'shadow',
  'superman',
  'batman',
  'spiderman',
  'trustno1',
  'freedom',
  'whatever',
  'secret',
  'summer',
  'winter',
  'love',
  'angel',
  'family',
  'money',
  'diamond',
  'killer',
  'hunter',
  'jordan',
  'michael',
  // Frequent first names
  'jennifer',
  'jessica',
  'charlie',
  'thomas',
  'robert',
  'daniel',
  'andrew',
  'matthew',
  'joshua',
  'ashley',
  // Pets, colors, food, brands
  'maggie',
  'chelsea',
  'harley',
  'ranger',
  'buster',
  'pepper',
  'ginger',
  'cookie',
  'chocolate',
  'coffee',
  'flower',
  'tigger',
  'purple',
  'silver',
  'golden',
  'banana',
  'cheese',
  'chicken',
  'computer',
  'google',
];

const commonPasswordSet = new Set(COMMON_PASSWORDS);

/**
 * Validates a candidate password against the shared policy.
 *
 * @returns A user-facing error message when the password is rejected,
 *          or `null` when it complies with the policy.
 */
export function validatePasswordPolicy(password: unknown): string | null {
  if (typeof password !== 'string') {
    return 'Password must be a string';
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`;
  }

  if (commonPasswordSet.has(password.toLowerCase())) {
    return 'This password is too common';
  }

  return null;
}

/**
 * class-validator decorator that enforces {@link validatePasswordPolicy}
 * so DTOs reject weak passwords through the global ValidationPipe.
 *
 * Pair with `@IsOptional()` for optional fields; pair with `@IsString()`
 * when a dedicated type error is preferred over the policy message.
 */
export function IsValidPassword(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return validatePasswordPolicy(value) === null;
        },
        defaultMessage(validationArguments?: ValidationArguments): string {
          const policyMessage = validatePasswordPolicy(
            validationArguments?.value,
          );
          if (policyMessage) {
            return policyMessage;
          }

          // ValidationOptions.message may also be a function; only inline
          // string overrides are supported here.
          const customMessage = validationOptions?.message;
          return typeof customMessage === 'string'
            ? customMessage
            : 'Password does not meet the security policy';
        },
      },
    });
  };
}
