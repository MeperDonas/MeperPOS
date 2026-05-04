import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class OrganizationStatusGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // SuperAdmin bypass
    if (user?.isSuperAdmin || user?.role === 'SUPER_ADMIN') {
      return true;
    }

    const orgStatus = user?.orgStatus;

    if (!orgStatus) {
      return true;
    }

    if (orgStatus === 'SUSPENDED') {
      const method = request.method;

      // Allow GET and HEAD for read-only access
      if (method === 'GET' || method === 'HEAD') {
        return true;
      }

      throw new ForbiddenException({
        message: 'Organization is suspended. Write operations are disabled.',
        status: 'SUSPENDED',
      });
    }

    return true;
  }
}
