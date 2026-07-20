import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator';

type AuditResponseContext = {
  resource?: string;
  resourceId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const action = this.reflector.getAllAndOverride<string>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      tap((response) => {
        void this.logAudit(action, url, method, request, response);
      }),
    );
  }

  private extractResource(url: string): string {
    const segments = url.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return segments[1].charAt(0).toUpperCase() + segments[1].slice(1);
    }
    return 'Unknown';
  }

  private extractResponseContext(
    response: unknown,
  ): AuditResponseContext | null {
    if (
      response &&
      typeof response === 'object' &&
      '__auditContext' in response
    ) {
      const auditContext = response.__auditContext;

      if (auditContext && typeof auditContext === 'object') {
        return auditContext as AuditResponseContext;
      }
    }

    return null;
  }

  private extractResourceId(
    request: Request,
    response: unknown,
  ): string | null {
    const responseContext = this.extractResponseContext(response);
    if (typeof responseContext?.resourceId === 'string') {
      return responseContext.resourceId;
    }

    if (response && typeof response === 'object' && 'id' in response) {
      const id = response.id;
      if (typeof id === 'string' || typeof id === 'number') {
        return String(id);
      }
    }
    if (response && typeof response === 'object' && 'data' in response) {
      const data = response.data as { id?: unknown };
      if (
        data.id &&
        (typeof data.id === 'string' || typeof data.id === 'number')
      ) {
        return String(data.id);
      }
    }

    const params = request.params as Record<string, unknown> | undefined;
    const paramId = params?.id;
    if (typeof paramId === 'string' || typeof paramId === 'number') {
      return String(paramId);
    }

    return null;
  }

  private buildSummary(
    action: string,
    method: string,
    request: Request,
    response: unknown,
  ): string {
    const responseContext = this.extractResponseContext(response);
    if (responseContext?.summary) {
      return responseContext.summary;
    }

    const payload = request.body as Record<string, unknown> | undefined;
    const changedFields = Object.keys(payload ?? {}).filter(
      (key) => payload?.[key] !== undefined && key !== 'password',
    );

    if (changedFields.length > 0) {
      return `${action} via ${method} (${changedFields.join(', ')})`;
    }

    return `${action} via ${method}`;
  }

  private async logAudit(
    action: string,
    url: string,
    method: string,
    request: Request,
    response: unknown,
  ): Promise<void> {
    const user = request['user'] as {
      sub: string;
      email: string;
      role: string;
      organizationId?: string;
    };

    if (!user || !user.sub) {
      this.logger.warn(
        `Skipping audit log for ${action} on ${url}: No authenticated user`,
      );
      return;
    }

    try {
      const responseContext = this.extractResponseContext(response);

      await this.prisma.auditLog.create({
        data: {
          userId: user.sub,
          organizationId: user.organizationId ?? '',
          action,
          resource: responseContext?.resource ?? this.extractResource(url),
          resourceId: this.extractResourceId(request, response),
          metadata: {
            summary: this.buildSummary(action, method, request, response),
            method,
            url,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
            timestamp: new Date().toISOString(),
            ...(responseContext?.metadata ?? {}),
          },
        },
      });

      this.logger.log(`Audit: ${action} by ${user.email} on ${url}`);
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
    }
  }
}
