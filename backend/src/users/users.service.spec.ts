import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organizationUser: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const planLimitServiceMock = {
    invalidateCache: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      prismaMock as never,
      planLimitServiceMock as never,
    );
  });

  it('creates users without returning password fields', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      active: true,
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      updatedAt: new Date('2026-03-24T00:00:00.000Z'),
    });

    const result = await service.create({
      email: 'user@example.com',
      password: 'password123',
      name: 'User One',
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'user@example.com',
          name: 'User One',
          password: expect.any(String),
        }),
        select: expect.any(Object),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User One',
      }),
    );
    expect(result).not.toHaveProperty('password');
  });

  it('rejects duplicate emails on update', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'old@example.com',
      active: true,
    });
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-3' });

    await expect(
      service.update('admin-1', 'user-2', { email: 'taken@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns audit context with meaningful field-level summary on update', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'old@example.com',
      name: 'Old Name',
      active: true,
    });
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.update.mockResolvedValue({
      id: 'user-2',
      email: 'new@example.com',
      name: 'New Name',
      active: true,
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      updatedAt: new Date('2026-03-24T01:00:00.000Z'),
    });

    const result = await service.update('admin-1', 'user-2', {
      email: 'new@example.com',
      name: 'New Name',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'user-2',
        email: 'new@example.com',
        name: 'New Name',
      }),
    );
    expect(Object.getOwnPropertyDescriptor(result, '__auditContext')).toEqual(
      expect.objectContaining({
        enumerable: false,
        value: expect.objectContaining({
          resourceId: 'user-2',
          summary: expect.stringContaining('name, email'),
          metadata: expect.objectContaining({
            changedFields: ['name', 'email'],
          }),
        }),
      }),
    );
  });

  it('prevents admins from deactivating themselves', async () => {
    await expect(
      service.toggleActive('admin-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('prevents admins from deleting themselves', async () => {
    await expect(service.remove('admin-1', 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it('returns audit context with the deleted user id', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User Two',
      active: true,
    });
    prismaMock.user.delete.mockResolvedValue({ id: 'user-2' });

    const result = await service.remove('admin-1', 'user-2');

    expect(result).toEqual({ message: 'User deleted successfully' });
    expect(Object.getOwnPropertyDescriptor(result, '__auditContext')).toEqual(
      expect.objectContaining({
        enumerable: false,
        value: expect.objectContaining({
          resourceId: 'user-2',
          summary: 'Deleted user User Two (user2@example.com)',
        }),
      }),
    );
  });

  it('resets passwords from the users boundary and records the audit entry', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User Two',
      active: true,
    });
    prismaMock.organizationUser.findFirst.mockResolvedValue({
      id: 'ou-1',
      userId: 'user-2',
      organizationId: 'org-1',
    });
    prismaMock.user.update.mockResolvedValue({ id: 'user-2' });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await expect(
      service.resetPassword(
        'admin-1',
        'user-2',
        {
          newPassword: 'NuevaClaveSegura123',
        },
        'org-1',
      ),
    ).resolves.toEqual({ message: 'Contraseña restablecida exitosamente' });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { password: expect.any(String) },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'admin-1',
          organizationId: 'org-1',
          action: 'ADMIN_PASSWORD_RESET',
          resourceId: 'user-2',
          metadata: expect.objectContaining({
            summary: 'Reset password for user User Two (user2@example.com)',
          }),
        }),
      }),
    );
  });

  it('filters findAll by organizationId when provided', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    await service.findAll('org-1');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationUsers: {
            some: { organizationId: 'org-1' },
          },
        },
      }),
    );
  });

  it('throws ForbiddenException when updating a user outside the organization', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User Two',
      active: true,
    });
    prismaMock.organizationUser.findFirst.mockResolvedValue(null);

    await expect(
      service.update('admin-1', 'user-2', { name: 'Hacked' }, 'org-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents removing the primary owner', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User Two',
      active: true,
    });
    prismaMock.organizationUser.findFirst.mockResolvedValue({
      id: 'ou-1',
      userId: 'user-2',
      organizationId: 'org-1',
      role: 'ADMIN',
      isPrimaryOwner: true,
    });

    await expect(
      service.remove('admin-1', 'user-2', 'org-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it('prevents removing the last admin of an organization', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User Two',
      active: true,
    });
    prismaMock.organizationUser.findFirst.mockResolvedValue({
      id: 'ou-1',
      userId: 'user-2',
      organizationId: 'org-1',
      role: 'ADMIN',
      isPrimaryOwner: false,
    });
    prismaMock.organizationUser.count.mockResolvedValue(1);

    await expect(
      service.remove('admin-1', 'user-2', 'org-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it('allows removing an admin when there are other admins', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User Two',
      active: true,
    });
    prismaMock.organizationUser.findFirst.mockResolvedValue({
      id: 'ou-1',
      userId: 'user-2',
      organizationId: 'org-1',
      role: 'ADMIN',
      isPrimaryOwner: false,
    });
    prismaMock.organizationUser.count.mockResolvedValue(2);
    prismaMock.user.delete.mockResolvedValue({ id: 'user-2' });

    const result = await service.remove('admin-1', 'user-2', 'org-1');

    expect(result).toEqual({ message: 'User deleted successfully' });
    expect(prismaMock.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-2' },
    });
  });
});
