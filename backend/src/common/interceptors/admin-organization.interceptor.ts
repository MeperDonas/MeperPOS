import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class AdminOrganizationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    if (user?.isSuperAdmin) {
      const headerOrgId = request.headers?.['x-organization-id'] as string | undefined;
      const queryOrgId = request.query?.organizationId as string | undefined;
      (user as any).organizationId = headerOrgId ?? queryOrgId ?? undefined;
    }

    return next.handle();
  }
}
