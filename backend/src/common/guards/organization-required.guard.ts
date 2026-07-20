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

    if (!user) {
      return true;
    }

    if (user.isSuperAdmin) {
      return true;
    }

    if (!user.organizationId) {
      throw new ForbiddenException(
        'Organization scope required. Please select an organization or use an admin endpoint.',
      );
    }

    return true;
  }
}
