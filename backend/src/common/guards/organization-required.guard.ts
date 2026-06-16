import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class OrganizationRequiredGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    // Unauthenticated requests are not handled here; JwtAuthGuard runs first.
    if (!user) {
      return true;
    }

    // Organization-scoped endpoints require a non-null organizationId.
    // SuperAdmin tokens carry organizationId: null and must use /admin routes.
    if (!user.organizationId) {
      throw new ForbiddenException(
        'Organization scope required. Please select an organization or use an admin endpoint.',
      );
    }

    return true;
  }
}
