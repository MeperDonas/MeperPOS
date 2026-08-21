import { JWT_SECRET_MIN_LENGTH, validateJwtSecretOrExit } from './runtime-env';

describe('validateJwtSecretOrExit', () => {
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    jest.clearAllMocks();
  });

  const buildEnv = (
    overrides: Partial<NodeJS.ProcessEnv> = {},
  ): NodeJS.ProcessEnv => ({
    NODE_ENV: 'test',
    JWT_SECRET: 'a'.repeat(JWT_SECRET_MIN_LENGTH),
    ...overrides,
  });

  it('should exit with an error when JWT_SECRET is missing in production', () => {
    validateJwtSecretOrExit(buildEnv({ NODE_ENV: 'production', JWT_SECRET: undefined }));

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should exit with an error when JWT_SECRET is shorter than the minimum in production', () => {
    validateJwtSecretOrExit(
      buildEnv({ NODE_ENV: 'production', JWT_SECRET: 'too-short-secret' }),
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(String(JWT_SECRET_MIN_LENGTH)),
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should only warn without exiting when JWT_SECRET is missing outside production', () => {
    validateJwtSecretOrExit(
      buildEnv({ NODE_ENV: 'development', JWT_SECRET: undefined }),
    );

    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should not log or exit when a strong JWT_SECRET is configured in production', () => {
    validateJwtSecretOrExit(buildEnv({ NODE_ENV: 'production' }));

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
