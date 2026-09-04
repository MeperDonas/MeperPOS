import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Transport/security wiring shared by the production bootstrap (main.ts) and
 * the integration specs that boot AppModule. Keeping it in one place means a
 * spec asserting security headers exercises the exact middleware the running
 * server uses — removing or weakening helmet here fails the header specs and
 * therefore CI (issue #48, spec 2.R1).
 */
export function configureApp(app: INestApplication): void {
  // CSP is disabled because Swagger UI assets conflict with strict policies and this API serves no HTML to end users.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Required for auth cookies: parses Cookie headers into req.cookies.
  app.use(cookieParser());

  app.setGlobalPrefix('api');
}
