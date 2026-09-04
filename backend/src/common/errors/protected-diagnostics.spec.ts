import { Logger } from '@nestjs/common';
import { recordProtectedDiagnostic } from './protected-diagnostics';

/**
 * RED baseline for protected diagnostics (issue #120, spec requirement:
 * Protected Diagnostics and Correlation).
 *
 * The protected recorder is the ONLY sink for original unexpected
 * diagnostics: boundary, correlation id, route/job context, and the original
 * throwable/stack travel to the structured log. Public payloads must never
 * carry them — this spec proves the recorder retains them on the log side.
 */
describe('recordProtectedDiagnostic (issue #120 protected logs)', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('logs the boundary, correlation id, and request context with the original error', () => {
    const original = new Error('connection refused to 10.0.0.5:5432');

    recordProtectedDiagnostic(
      {
        boundary: 'http',
        requestId: 'req-abc',
        method: 'GET',
        path: '/api/products',
      },
      original,
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message] = errorSpy.mock.calls[0] as [string, unknown];
    expect(message).toContain('boundary=http');
    expect(message).toContain('requestId=req-abc');
    expect(message).toContain('method=GET');
    expect(message).toContain('path=/api/products');
  });

  it('retains the original sensitive error text and stack on the protected log', () => {
    const original = new Error('ORA-12345 password=hunter2 leaked');
    original.stack =
      'Error: ORA-12345 password=hunter2 leaked\n    at rowJob()';

    recordProtectedDiagnostic({ boundary: 'import-row' }, original);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, stackOrDetail] = errorSpy.mock.calls[0] as [string, unknown];
    expect(String(stackOrDetail)).toContain('hunter2');
    expect(String(stackOrDetail)).toContain('rowJob');
  });

  it('summarizes non-Error throwables without crashing', () => {
    recordProtectedDiagnostic({ boundary: 'http' }, 'string panic');

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts an empty context and still records the diagnostic', () => {
    recordProtectedDiagnostic({}, new Error('boom'));

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
