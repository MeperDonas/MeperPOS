import { resolveReceiptLogo } from './receipt-logo';
import { promises as files, constants } from 'node:fs';
import processes, { type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="red"/></svg>';
const gif = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);
const webp = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  'base64',
);
const localName = '12345678-1234-4123-8123-123456789abc';

// Mock filesystem I/O only; the actual native decoder and child process run.
function mockLocalLogo(bytes: Buffer) {
  const stat = {
    size: bytes.length,
    dev: 1,
    ino: 1,
    isFile: () => true,
    isDirectory: () => true,
    isSymbolicLink: () => false,
  };
  jest.spyOn(files, 'lstat').mockResolvedValue(stat as never);
  jest
    .spyOn(files, 'realpath')
    .mockImplementation((path) => Promise.resolve(String(path)));
  const handle = {
    stat: jest.fn().mockResolvedValue(stat),
    read: jest
      .fn()
      .mockImplementation(
        (buffer: Buffer, offset: number, length: number, position: number) => {
          const bytesRead = bytes.copy(
            buffer,
            offset,
            position,
            position + length,
          );
          return Promise.resolve({ buffer, bytesRead });
        },
      ),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const open = jest.spyOn(files, 'open').mockResolvedValue(handle as never);
  return { open, handle, stat };
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4XmNgYGD4DwABBAEA43qFxAAAAABJRU5ErkJggg==',
  'base64',
);
const trusted =
  'https://res.cloudinary.com/receipt-test/image/upload/v1/logos/test.png';
const delivery =
  'https://res.cloudinary.com/receipt-test/image/upload/c_limit,f_png,h_300,w_600/v1/logos/test.png';

describe('resolveReceiptLogo', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([
    ['gif', gif],
    ['webp', webp],
  ] as const)(
    'decodes local %s with existing jsPDF in isolation',
    async (extension, bytes) => {
      mockLocalLogo(bytes);
      const logo = await resolveReceiptLogo(
        `/uploads/logos/${localName}.${extension}`,
        undefined,
        '/receipt-fixtures',
      );
      expect(logo?.format).toBe('JPEG');
      expect(logo!.bytes.length).toBeLessThan(1048576);
    },
  );

  it('supports unversioned configured Cloudinary originals without carrying input transformations', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(png));
    await resolveReceiptLogo(
      trusted.replace('/v1/', '/').replace('.png', '.svg'),
      'receipt-test',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      delivery.replace('/v1/', '/'),
      expect.any(Object),
    );
  });

  it.each([
    `/uploads/logos/../${localName}.png`,
    `/uploads/logos/%2e%2e/${localName}.png`,
    `/uploads/logos/${localName}.png?file=elsewhere`,
    `/uploads/products/${localName}.png`,
    '/uploads/logos/not-generated.svg',
    `/uploads/logos/${localName.replace('-4123-', '-1123-')}.png`,
  ])('does not open hostile or non-generated local path %s', async (value) => {
    const { open } = mockLocalLogo(png);
    expect(
      await resolveReceiptLogo(value, undefined, '/receipt-fixtures'),
    ).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });

  it.each(['root', 'directory', 'file'])(
    'rejects a symlink at the local %s',
    async (location) => {
      const { open, stat } = mockLocalLogo(png);
      const target =
        location === 'root'
          ? '/receipt-fixtures'
          : location === 'directory'
            ? '/receipt-fixtures/logos'
            : `/receipt-fixtures/logos/${localName}.png`;
      jest.mocked(files.lstat).mockImplementation((path) =>
        Promise.resolve({
          ...stat,
          isSymbolicLink: () => String(path) === target,
        } as never),
      );
      expect(
        await resolveReceiptLogo(
          `/uploads/logos/${localName}.png`,
          undefined,
          '/receipt-fixtures',
        ),
      ).toBeUndefined();
      expect(open).not.toHaveBeenCalled();
    },
  );

  it('rejects realpath escape before opening and an inode swap after opening', async () => {
    const { open, handle, stat } = mockLocalLogo(png);
    jest
      .mocked(files.realpath)
      .mockImplementation((path) =>
        Promise.resolve(
          String(path).endsWith('.png') ? '/outside/logo.png' : String(path),
        ),
      );
    expect(
      await resolveReceiptLogo(
        `/uploads/logos/${localName}.png`,
        undefined,
        '/receipt-fixtures',
      ),
    ).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
    jest
      .mocked(files.realpath)
      .mockImplementation((path) => Promise.resolve(String(path)));
    handle.stat.mockResolvedValue({ ...stat, ino: 2 });
    expect(
      await resolveReceiptLogo(
        `/uploads/logos/${localName}.png`,
        undefined,
        '/receipt-fixtures',
      ),
    ).toBeUndefined();
    expect(handle.read).not.toHaveBeenCalled();
    expect(handle.close).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      expect.any(String),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  });

  it('reads from the default application upload root', async () => {
    const { open } = mockLocalLogo(png);
    expect(
      (await resolveReceiptLogo(`/uploads/logos/${localName}.png`))?.format,
    ).toBe('PNG');
    expect(open).toHaveBeenCalledWith(
      join(process.cwd(), 'uploads', 'logos', `${localName}.png`),
      expect.any(Number),
    );
  });

  it.each([gif, webp])(
    'rejects excessive GIF/WebP dimensions before decoder launch',
    async (source) => {
      const bytes = Buffer.from(source);
      if (bytes.subarray(0, 3).toString() === 'GIF') {
        bytes.writeUInt16LE(65000, 6);
        bytes.writeUInt16LE(65000, 8);
      } else {
        bytes.writeUInt16LE(16000, 26);
        bytes.writeUInt16LE(16000, 28);
      }
      mockLocalLogo(bytes);
      const spawn = jest.spyOn(processes, 'spawn');
      const extension = source === gif ? 'gif' : 'webp';
      expect(
        await resolveReceiptLogo(
          `/uploads/logos/${localName}.${extension}`,
          undefined,
          '/receipt-fixtures',
        ),
      ).toBeUndefined();
      expect(spawn).not.toHaveBeenCalled();
    },
  );

  it('rejects an initially oversized local file', async () => {
    const { stat, open } = mockLocalLogo(png);
    stat.size = 1048577;
    expect(
      await resolveReceiptLogo(
        `/uploads/logos/${localName}.png`,
        undefined,
        '/receipt-fixtures',
      ),
    ).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });

  it('rejects file size growth beyond the input bound', async () => {
    const bytes = Buffer.alloc(1048577);
    const { stat } = mockLocalLogo(bytes);
    stat.size = 1;
    expect(
      await resolveReceiptLogo(
        `/uploads/logos/${localName}.png`,
        undefined,
        '/receipt-fixtures',
      ),
    ).toBeUndefined();
  });

  it.each([
    '<image href="/outside/logo.png"/>',
    '<image href="file:///outside/logo.png"/>',
    '<image href="https://evil.example/logo.png"/>',
    '<image xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="&#47;outside/logo.png"/>',
    '<image href="data:image/svg+xml;base64,PHN2Zz4="/>',
    '<image href="#local-filename"/>',
    '<rect style="fill:url(https://evil.example/a)"/>',
    '<style>@import "https://evil.example/a";</style>',
    '<style>rect {fill:u\\\\72l(https://evil.example/a)}</style>',
    '<script>alert(1)</script>',
    '<foreignObject/>',
    '<rect onclick="alert(1)"/>',
    '<g xml:base="/outside"/>',
  ])(
    'rejects SVG active or external resources %s before resvg',
    async (content) => {
      mockLocalLogo(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20">${content}</svg>`,
        ),
      );
      expect(
        await resolveReceiptLogo(
          `/uploads/logos/${localName}.svg`,
          undefined,
          '/receipt-fixtures',
        ),
      ).toBeUndefined();
    },
  );

  it.each([
    '<!DOCTYPE svg [<!ENTITY ext SYSTEM "file:///outside">]><svg xmlns="http://www.w3.org/2000/svg"/>',
    svg.replace('width="40"', 'width="1000000"'),
    `<svg xmlns="http://www.w3.org/2000/svg">${'<path d="M0 0L1 1"/>'.repeat(4096)}</svg>`,
    '<svg malformed',
  ])(
    'bounds SVG declarations, dimensions, complexity and malformed input',
    async (content) => {
      mockLocalLogo(Buffer.from(content));
      expect(
        await resolveReceiptLogo(
          `/uploads/logos/${localName}.svg`,
          undefined,
          '/receipt-fixtures',
        ),
      ).toBeUndefined();
    },
  );

  it('keeps safe gradients, CSS fragment references and embedded PNGs', async () => {
    const content = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><defs><linearGradient id="a"><stop stop-color="red"/></linearGradient><path id="shape" d="M0 0L10 10"/></defs><style>rect {fill:url(#a)}</style><rect width="40" height="20"/><use href="&#35;shape"/><image href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
    mockLocalLogo(Buffer.from(content));
    expect(
      (
        await resolveReceiptLogo(
          `/uploads/logos/${localName}.svg`,
          undefined,
          '/receipt-fixtures',
        )
      )?.format,
    ).toBe('PNG');
  });

  it('fits native SVG output within 600 by 300 pixels', async () => {
    mockLocalLogo(
      Buffer.from(svg.replace(/"40"/g, '"1600"').replace(/"20"/g, '"800"')),
    );
    const logo = await resolveReceiptLogo(
      `/uploads/logos/${localName}.svg`,
      undefined,
      '/receipt-fixtures',
    );
    const bytes = Buffer.from(logo!.bytes);
    expect(bytes.readUInt32BE(16)).toBe(600);
    expect(bytes.readUInt32BE(20)).toBe(300);
  });

  it('kills a renderer producing oversized output', async () => {
    mockLocalLogo(Buffer.from(svg));
    const realSpawn = processes.spawn;
    let child: ChildProcess;
    jest.spyOn(processes, 'spawn').mockImplementation(() => {
      child = realSpawn(
        process.execPath,
        [
          '-e',
          'process.stdin.resume(); process.stdout.write(Buffer.alloc(1048577));',
        ],
        { env: {}, stdio: ['pipe', 'pipe', 'ignore'] },
      );
      jest.spyOn(child, 'kill');
      return child;
    });
    expect(
      await resolveReceiptLogo(
        `/uploads/logos/${localName}.svg`,
        undefined,
        '/receipt-fixtures',
      ),
    ).toBeUndefined();
    expect(child!.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('kills a genuinely stalled renderer process after the bounded deadline', async () => {
    mockLocalLogo(Buffer.from(svg));
    const realSpawn = processes.spawn;
    let child: ChildProcess;
    jest.spyOn(processes, 'spawn').mockImplementation(() => {
      child = realSpawn(
        process.execPath,
        ['-e', 'process.stdin.resume(); setInterval(() => {}, 1000)'],
        { env: {}, stdio: ['pipe', 'pipe', 'ignore'] },
      );
      jest.spyOn(child, 'kill');
      return child;
    });
    const started = Date.now();
    expect(
      await resolveReceiptLogo(
        `/uploads/logos/${localName}.svg`,
        undefined,
        '/receipt-fixtures',
      ),
    ).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(4500);
    expect(child!.kill).toHaveBeenCalledWith('SIGKILL');
    await new Promise<void>((resolve) => child!.on('close', () => resolve()));
  });

  it.each(['webp', 'gif', 'svg', 'png', 'jpeg'])(
    'normalizes trusted original %s to bounded PNG delivery',
    async (extension) => {
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(png));
      expect(
        (
          await resolveReceiptLogo(
            trusted.replace('.png', `.${extension}`),
            'receipt-test',
          )
        )?.format,
      ).toBe('PNG');
      expect(fetchMock).toHaveBeenCalledWith(
        delivery,
        expect.objectContaining({ redirect: 'error' }),
      );
    },
  );

  it('loads a generated local PNG only under the configured upload root', async () => {
    const { open, handle } = mockLocalLogo(png);
    const logo = await resolveReceiptLogo(
      `/uploads/logos/${localName}.png`,
      undefined,
      '/receipt-fixtures',
    );
    expect(logo?.format).toBe('PNG');
    expect(open).toHaveBeenCalledWith(
      `/receipt-fixtures/logos/${localName}.png`,
      expect.any(Number),
    );
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it('rasterizes a safe local SVG with native resvg in isolation', async () => {
    mockLocalLogo(Buffer.from(svg));
    const logo = await resolveReceiptLogo(
      `/uploads/logos/${localName}.svg`,
      undefined,
      '/receipt-fixtures',
    );
    expect(logo?.format).toBe('PNG');
    expect(Buffer.from(logo!.bytes).subarray(0, 8)).toEqual(png.subarray(0, 8));
  });

  it('fetches the configured HTTPS Cloudinary logo with redirects disabled', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(png));
    const logo = await resolveReceiptLogo(trusted, 'receipt-test');
    expect(logo?.format).toBe('PNG');
    expect(Buffer.from(logo!.bytes)).toEqual(png);
    expect(fetchMock).toHaveBeenCalledWith(
      delivery,
      expect.objectContaining({
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    null,
    '/etc/passwd',
    'file:///etc/passwd',
    'http://res.cloudinary.com/receipt-test/image/upload/v1/logos/test.png',
    'https://res.cloudinary.com.evil.test/receipt-test/image/upload/v1/logos/test.png',
    'https://res.cloudinary.com/other/image/upload/v1/logos/test.png',
    'https://res.cloudinary.com/receipt-test/image/fetch/v1/logos/test.png',
    'https://res.cloudinary.com/receipt-test/image/upload/v1/products/test.png',
    'https://user:pass@res.cloudinary.com/receipt-test/image/upload/v1/logos/test.png',
    `${trusted}?url=http://localhost`,
    trusted.replace('/logos/', '/logos/%2e%2e/'),
    trusted.replace('/logos/', '/products/../logos/'),
    trusted.replace('/v1/', '/f_auto/'),
    trusted.replace('/v1/', '/c_limit,f_png,h_300,w_600/v1/'),
    trusted.replace('/v1/', '/s--untrusted--/v1/'),
  ])('does not fetch untrusted source %s', async (value) => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    expect(await resolveReceiptLogo(value, 'receipt-test')).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the cloud is not configured', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    expect(await resolveReceiptLogo(trusted)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts bounded PNG data URLs without fetching', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    expect(
      (
        await resolveReceiptLogo(
          `data:image/png;base64,${png.toString('base64')}`,
        )
      )?.format,
    ).toBe('PNG');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    'data:image/png;base64,AAA',
    'data:image/svg+xml;base64,PHN2Zz4=',
    `data:image/jpeg;base64,${png.toString('base64')}`,
  ])('rejects malformed or mismatched data %s', async (value) => {
    expect(await resolveReceiptLogo(value)).toBeUndefined();
  });

  it.each([
    new Response('invalid'),
    new Response(null, { status: 404 }),
    new Response(null, {
      status: 302,
      headers: { location: 'https://localhost/logo.png' },
    }),
    new Response(png, { headers: { 'content-length': '1048577' } }),
  ])(
    'omits invalid, unavailable, redirect or oversized responses',
    async (response) => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);
      expect(await resolveReceiptLogo(trusted, 'receipt-test')).toBeUndefined();
    },
  );

  it('bounds streamed bytes without relying on content-length', async () => {
    const cancel = jest.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1048577));
      },
      cancel,
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream));
    expect(await resolveReceiptLogo(trusted, 'receipt-test')).toBeUndefined();
    expect(cancel).toHaveBeenCalled();
  });

  it('aborts a hung request after three seconds and degrades safely', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    jest.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise((_resolve, reject) =>
        signal!.addEventListener('abort', () => reject(new Error('aborted'))),
      );
    });
    const promise = resolveReceiptLogo(trusted, 'receipt-test');
    await jest.advanceTimersByTimeAsync(3000);
    expect(signal?.aborted).toBe(true);
    expect(await promise).toBeUndefined();
  });

  it('rejects a JPEG signature without a valid frame and scan', async () => {
    expect(
      await resolveReceiptLogo('data:image/jpeg;base64,/9j/AA=='),
    ).toBeUndefined();
  });

  it('keeps the deadline active while the response body stalls', async () => {
    jest.useFakeTimers();
    jest.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(png.subarray(0, 8)));
          options?.signal?.addEventListener('abort', () =>
            controller.error(new Error('aborted')),
          );
        },
      });
      return Promise.resolve(new Response(stream));
    });
    const promise = resolveReceiptLogo(trusted, 'receipt-test');
    await jest.advanceTimersByTimeAsync(3000);
    expect(await promise).toBeUndefined();
  });

  it('rejects oversized PNG dimensions before decompression', async () => {
    const oversized = Buffer.from(png);
    oversized.writeUInt32BE(10000, 16);
    oversized.writeUInt32BE(10000, 20);
    expect(
      await resolveReceiptLogo(
        `data:image/png;base64,${oversized.toString('base64')}`,
      ),
    ).toBeUndefined();
  });

  it('handles network failures', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await resolveReceiptLogo(trusted, 'receipt-test')).toBeUndefined();
  });
});
