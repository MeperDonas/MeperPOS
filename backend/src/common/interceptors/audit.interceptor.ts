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
import { RequestUser } from '../interfaces/request-user.interface';

type AuditResponseContext = {
  resource?: string;
  resourceId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
};

type ResolvedActor = {
  userId?: string;
  email?: string;
  role?: string;
  organizationId?: string | null;
  /** True when request.user only carries the legacy { sub } fixture shape. */
  legacySubShape?: boolean;
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
    const actor = this.resolveActor(request, response);

    if (!actor) {
      this.logger.warn(
        `Skipping audit log for ${action} on ${url}: no authenticated user or response actor`,
      );
      return;
    }

    if (actor.legacySubShape) {
      this.logger.warn(
        `Skipping audit log for ${action} on ${url}: request.user carries the legacy sub shape; use RequestUser.userId`,
      );
      return;
    }

    if (
      typeof actor.userId !== 'string' ||
      actor.userId.length === 0 ||
      typeof actor.organizationId !== 'string' ||
      actor.organizationId.length === 0
    ) {
      this.logger.warn(
        `Skipping audit log for ${action} on ${url}: userId or organizationId is empty or missing`,
      );
      return;
    }

    try {
      const responseContext = this.extractResponseContext(response);

      await this.prisma.auditLog.create({
        data: {
          userId: actor.userId,
          organizationId: actor.organizationId,
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

      this.logger.log(
        `Audit: ${action} by ${actor.email ?? actor.userId} on ${url}`,
      );
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
    }
  }

  /**
   * Resolves the audit actor/org pair, preferring the authenticated
   * request.user (RequestUser.userId) and falling back to the response actor
   * exposed by unauthenticated-but-audited auth routes (login,
   * select-organization) which carry response.user { id, organizationId }.
   * Returns null when neither is present (warn-skip).
   */
  private resolveActor(
    request: Request,
    response: unknown,
  ): ResolvedActor | null {
    const requestUser = request.user as
      | (RequestUser & { sub?: string })
      | undefined;

    if (requestUser) {
      // A { sub }-only actor is the legacy fixture shape, never the canonical
      // contract — treat it as unresolvable so old fixtures fail loudly.
      if (typeof requestUser.userId !== 'string' && 'sub' in requestUser) {
        return { legacySubShape: true };
      }

      if (typeof requestUser.userId === 'string') {
        return {
          userId: requestUser.userId,
          email: requestUser.email,
          role: requestUser.role,
          organizationId: requestUser.organizationId,
        };
      }
    }

    const responseUser = this.extractResponseUser(response);
    if (responseUser) {
      return {
        userId: responseUser.id,
        email: responseUser.email,
        role: responseUser.role,
        organizationId: responseUser.organizationId,
      };
    }

    return null;
  }

  private extractResponseUser(response: unknown): {
    id: string;
    email?: string;
    role?: string;
    organizationId?: string | null;
  } | null {
    if (
      response &&
      typeof response === 'object' &&
      'user' in response &&
      response.user &&
      typeof response.user === 'object'
    ) {
      const user = response.user as {
        id?: unknown;
        email?: unknown;
        role?: unknown;
        organizationId?: unknown;
      };
      if (typeof user.id === 'string' && user.id.length > 0) {
        return {
          id: user.id,
          email: typeof user.email === 'string' ? user.email : undefined,
          role: typeof user.role === 'string' ? user.role : undefined,
          organizationId:
            typeof user.organizationId === 'string'
              ? user.organizationId
              : null,
        };
      }
    }
    return null;
  }
}
