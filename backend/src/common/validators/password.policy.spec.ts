import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from './password.policy';
import { ChangePasswordDto, RegisterDto } from '../../auth/dto/auth.dto';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { ResetUserPasswordDto } from '../../users/dto/reset-user-password.dto';
import { CreateOrganizationDto } from '../../admin/dto/create-organization.dto';
import { AddOrganizationMemberDto } from '../../admin/dto/add-organization-member.dto';

describe('validatePasswordPolicy', () => {
  it('rejects passwords shorter than the minimum length', () => {
    expect(validatePasswordPolicy('Pass123')).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  });

  it('accepts a password of exactly the minimum length', () => {
    expect(validatePasswordPolicy('luna-sol-1')).toBeNull();
  });

  it('rejects top-common passwords case-insensitively', () => {
    expect(validatePasswordPolicy('PASSWORD123')).toBe(
      'This password is too common',
    );
    expect(validatePasswordPolicy('QwertyUiop')).toBe(
      'This password is too common',
    );
    expect(validatePasswordPolicy('Welcome123')).toBe(
      'This password is too common',
    );
  });

  it('rejects passwords longer than the maximum length', () => {
    expect(validatePasswordPolicy('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`,
    );
  });

  it('accepts a password of exactly the maximum length', () => {
    expect(validatePasswordPolicy('a'.repeat(PASSWORD_MAX_LENGTH))).toBeNull();
  });

  it('accepts a strong passphrase without composition rules', () => {
    expect(validatePasswordPolicy('correct-horse-battery-staple')).toBeNull();
  });

  it('rejects non-string values defensively', () => {
    expect(validatePasswordPolicy(null)).toBe('Password must be a string');
    expect(validatePasswordPolicy(1234567890)).toBe(
      'Password must be a string',
    );
  });
});

describe('password policy DTO enforcement', () => {
  const strongPassword = 'correct-horse-battery-staple';

  function passwordConstraintOf(errors: Record<string, unknown>[]) {
    return errors
      .filter((error) => error['property'] === 'password')
      .flatMap((error) => error['constraints']);
  }

  it('enforces the policy on RegisterDto.password', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      name: 'John Doe',
      password: 'short',
    });

    const errors = await validate(dto);

    expect(passwordConstraintOf(errors as never)).toEqual([
      { isValidPassword: 'Password must be at least 10 characters' },
    ]);
  });

  it('accepts a policy-compliant RegisterDto', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      name: 'John Doe',
      password: strongPassword,
    });

    expect(await validate(dto)).toEqual([]);
  });

  it('enforces the policy on ChangePasswordDto.newPassword only', async () => {
    const weakNewPassword = plainToInstance(ChangePasswordDto, {
      currentPassword: 'whatever-current',
      newPassword: 'password123',
    });

    const errors = await validate(weakNewPassword);
    const newPasswordError = errors.find(
      (error) => error.property === 'newPassword',
    );

    expect(newPasswordError?.constraints?.isValidPassword).toBe(
      'This password is too common',
    );

    // The current-password field is a verification input, not a new secret:
    // it must never be rejected for failing the set-policy.
    const verificationOnly = plainToInstance(ChangePasswordDto, {
      currentPassword: 'legacy',
      newPassword: strongPassword,
    });

    const verificationErrors = await validate(verificationOnly);
    expect(
      verificationErrors.filter((error) => error.property === 'currentPassword'),
    ).toEqual([]);
  });

  it('enforces the policy on the users module CreateUserDto.password', async () => {
    const dto = plainToInstance(CreateUserDto, {
      email: 'user@example.com',
      name: 'John Doe',
      password: 'abc123',
    });

    const errors = await validate(dto);
    const passwordError = errors.find((error) => error.property === 'password');

    expect(passwordError?.constraints?.isValidPassword).toBe(
      'Password must be at least 10 characters',
    );
  });

  it('enforces the policy on ResetUserPasswordDto.newPassword', async () => {
    const dto = plainToInstance(ResetUserPasswordDto, {
      newPassword: 'PASSWORD123',
    });

    const errors = await validate(dto);
    const passwordError = errors.find(
      (error) => error.property === 'newPassword',
    );

    expect(passwordError?.constraints?.isValidPassword).toBe(
      'This password is too common',
    );
  });

  it('enforces the policy on the nested admin password of CreateOrganizationDto', async () => {
    const dto = plainToInstance(CreateOrganizationDto, {
      name: 'Org',
      slug: 'org',
      admin: {
        name: 'Admin',
        email: 'admin@example.com',
        password: 'short',
      },
    });

    const errors = await validate(dto);
    const adminError = errors.find((error) => error.property === 'admin');
    const passwordChild = adminError?.children?.find(
      (error) => error.property === 'password',
    );

    expect(passwordChild?.constraints?.isValidPassword).toBe(
      'Password must be at least 10 characters',
    );
  });

  it('keeps AddOrganizationMemberDto.password optional but validated when present', async () => {
    const withoutPassword = plainToInstance(AddOrganizationMemberDto, {
      email: 'member@example.com',
      role: 'CASHIER',
    });

    expect(await validate(withoutPassword)).toEqual([]);

    const withWeakPassword = plainToInstance(AddOrganizationMemberDto, {
      email: 'member@example.com',
      role: 'CASHIER',
      password: 'password123',
    });

    const errors = await validate(withWeakPassword);
    const passwordError = errors.find((error) => error.property === 'password');

    expect(passwordError?.constraints?.isValidPassword).toBe(
      'This password is too common',
    );
  });
});
