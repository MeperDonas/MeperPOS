import * as fs from 'fs';
import * as path from 'path';
import { ReceiptsService } from './receipts.service';
import { ConfigService } from '@nestjs/config';
import { buildReceiptData } from './receipt-data';

// pdf-parse's package entry has a debug side effect when imported without a
// parent module; import the lib entry directly (same extraction behavior).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
  b: Uint8Array,
) => Promise<{ text: string }>;

const FIXTURES_DIR = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'fixtures',
  'receipts',
);

const baselines: { expected: Record<string, string> } = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, 'baselines.json'), 'utf-8'),
);
const inputs: Record<string, { sale: unknown; settings: unknown }> = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, 'fixture-inputs.json'), 'utf-8'),
);

function normalizeExtracted(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

describe('ReceiptData contract (buildReceiptData)', () => {
  const baseSale = {
    saleNumber: 42,
    createdAt: '2026-06-15T14:30:00.000Z',
    customer: { name: 'Ana María Torres' },
    items: [
      {
        product: { name: 'Café de Origen' },
        quantity: 2,
        unitPrice: '1500',
        taxRate: '19',
        total: '3000',
      },
    ],
    payments: [{ method: 'CASH', amount: '5000' }],
    subtotal: '3000',
    taxAmount: '570',
    discountAmount: '0',
    total: '3570',
    change: '1430',
  };

  const baseSettings = {
    organization: { name: 'Tienda Test', logoUrl: null },
    invoicing: { printHeader: 'Header text', printFooter: 'Footer text' },
    receipt: { prefix: 'REC' },
  };

  it('builds receiptNumber from the settings prefix and sale number', () => {
    const data = buildReceiptData(baseSale as never, baseSettings as never);
    expect(data.receiptNumber).toBe('REC-42');
    expect(data.saleNumber).toBe(42);
  });

  it('falls back to the plain sale number when no prefix is configured', () => {
    const data = buildReceiptData(
      baseSale as never,
      {
        ...baseSettings,
        receipt: { prefix: null },
      } as never,
    );
    expect(data.receiptNumber).toBe('42');
  });

  it('maps company name, header, footer and logoUrl from settings', () => {
    const data = buildReceiptData(
      baseSale as never,
      {
        ...baseSettings,
        organization: { name: 'Mi Org', logoUrl: 'data:image/png;base64,AAA' },
      } as never,
    );
    expect(data.companyName).toBe('Mi Org');
    expect(data.header).toBe('Header text');
    expect(data.footer).toBe('Footer text');
    expect(data.logoUrl).toBe('data:image/png;base64,AAA');
  });

  it('falls back to the default company name when the organization name is empty', () => {
    const data = buildReceiptData(
      baseSale as never,
      {
        ...baseSettings,
        organization: { name: '', logoUrl: null },
      } as never,
    );
    expect(data.companyName).toBe('Mi Negocio');
  });

  it('maps customerName and falls back to null when the sale has no customer', () => {
    const withCustomer = buildReceiptData(
      baseSale as never,
      baseSettings as never,
    );
    expect(withCustomer.customerName).toBe('Ana María Torres');

    const withoutCustomer = buildReceiptData(
      { ...baseSale, customer: null } as never,
      baseSettings as never,
    );
    expect(withoutCustomer.customerName).toBeNull();
  });

  it('maps items with the display-name fallback for deleted products', () => {
    const data = buildReceiptData(baseSale as never, baseSettings as never);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toEqual({
      name: 'Café de Origen',
      quantity: 2,
      unitPrice: 1500,
      total: 3000,
    });

    const deleted = buildReceiptData(
      {
        ...baseSale,
        items: [{ ...baseSale.items[0], product: null }],
      } as never,
      baseSettings as never,
    );
    expect(deleted.items[0].name).toBe('Producto eliminado');
  });

  it('maps payments to method and numeric amount', () => {
    const data = buildReceiptData(
      {
        ...baseSale,
        payments: [
          { method: 'CASH', amount: '20000' },
          { method: 'CARD', amount: '18280' },
        ],
      } as never,
      baseSettings as never,
    );
    expect(data.payments).toEqual([
      { method: 'CASH', amount: 20000 },
      { method: 'CARD', amount: 18280 },
    ]);
  });

  it('converts monetary fields to numbers and keeps zero amounts as zero', () => {
    const data = buildReceiptData(
      {
        ...baseSale,
        discountAmount: '500',
        taxAmount: '0',
        change: null,
      } as never,
      baseSettings as never,
    );
    expect(data.subtotal).toBe(3000);
    expect(data.taxAmount).toBe(0);
    expect(data.discount).toBe(500);
    expect(data.total).toBe(3570);
    expect(data.change).toBeNull();
  });

  it('derives the tax rate from the first item and defaults to 0 without items', () => {
    const withItems = buildReceiptData(
      baseSale as never,
      baseSettings as never,
    );
    expect(withItems.taxRate).toBe(19);

    const noItems = buildReceiptData(
      { ...baseSale, items: [] } as never,
      baseSettings as never,
    );
    expect(noItems.taxRate).toBe(0);
  });
});

describe('receipt logo embedding', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [
      'svg',
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="red"/></svg>',
      ),
    ],
    [
      'gif',
      Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64',
      ),
    ],
    [
      'webp',
      Buffer.from(
        'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
        'base64',
      ),
    ],
  ] as const)(
    'embeds actual rasterized local %s bytes into the PDF',
    async (extension, bytes) => {
      const stat = {
        size: bytes.length,
        dev: 1,
        ino: 1,
        isFile: () => true,
        isDirectory: () => true,
        isSymbolicLink: () => false,
      };
      jest.spyOn(fs.promises, 'lstat').mockResolvedValue(stat as never);
      jest
        .spyOn(fs.promises, 'realpath')
        .mockImplementation((path) => Promise.resolve(String(path)));
      const close = jest.fn().mockResolvedValue(undefined);
      const open = jest.spyOn(fs.promises, 'open').mockResolvedValue({
        stat: () => Promise.resolve(stat),
        read: (
          buffer: Buffer,
          offset: number,
          length: number,
          position: number,
        ) =>
          Promise.resolve({
            bytesRead: bytes.copy(buffer, offset, position, position + length),
            buffer,
          }),
        close,
      } as never);
      const service = new ReceiptsService(
        new ConfigService({ LOCAL_UPLOAD_PATH: '/receipt-fixtures' }),
      );
      const fixture = Object.values(inputs)[0];
      const basename = `12345678-1234-4123-8123-123456789abc.${extension}`;
      const pdf = await service.generateSaleReceiptPdf(
        fixture.sale as never,
        {
          ...(fixture.settings as object),
          organization: { name: 'Test', logoUrl: `/uploads/logos/${basename}` },
        } as never,
      );
      expect(open).toHaveBeenCalledWith(
        `/receipt-fixtures/logos/${basename}`,
        expect.any(Number),
      );
      expect(close).toHaveBeenCalledTimes(1);
      expect(pdf.toString('latin1')).toContain('/Subtype /Image');
      expect(pdf.toString('latin1')).toContain('/Width');
    },
  );

  it.each(['webp', 'gif', 'svg'])(
    'embeds transformed Cloudinary %s originals as PNG images',
    async (extension) => {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4XmNgYGD4DwABBAEA43qFxAAAAABJRU5ErkJggg==',
        'base64',
      );
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(png));
      const service = new ReceiptsService(
        new ConfigService({ CLOUDINARY_CLOUD_NAME: 'receipt-test' }),
      );
      const fixture = Object.values(inputs)[0];
      const pdf = await service.generateSaleReceiptPdf(
        fixture.sale as never,
        {
          ...(fixture.settings as object),
          organization: {
            name: 'Test',
            logoUrl: `https://res.cloudinary.com/receipt-test/image/upload/v1/logos/test.${extension}`,
          },
        } as never,
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://res.cloudinary.com/receipt-test/image/upload/c_limit,f_png,h_300,w_600/v1/logos/test.png',
        expect.any(Object),
      );
      expect(pdf.toString('latin1')).toContain('/Subtype /Image');
    },
  );

  it.each([
    [
      'png',
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4XmNgYGD4DwABBAEA43qFxAAAAABJRU5ErkJggg==',
    ],
    // One-pixel grayscale JPEG: quantization, frame, Huffman tables and scan.
    [
      'jpeg',
      '/9j/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AP//Z',
    ],
  ])(
    'embeds remote and data URL %s bytes as PDF images',
    async (format, base64) => {
      const fixture = Object.values(inputs)[0];
      const bytes = Buffer.from(base64, 'base64');
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() => Promise.resolve(new Response(bytes)));
      const service = new ReceiptsService(
        new ConfigService({ CLOUDINARY_CLOUD_NAME: 'receipt-test' }),
      );
      for (const logoUrl of [
        `https://res.cloudinary.com/receipt-test/image/upload/v1/logos/test.${format}`,
        `data:image/${format};base64,${base64}`,
      ]) {
        const pdf = await service.generateSaleReceiptPdf(
          fixture.sale as never,
          {
            ...(fixture.settings as object),
            organization: { name: 'Test', logoUrl },
          } as never,
        );
        expect(pdf.toString('latin1')).toContain('/Subtype /Image');
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    null,
    '/etc/passwd',
    'data:image/png;base64,AAA',
    'https://res.cloudinary.com/receipt-test/image/upload/v1/logos/broken.png',
  ])(
    'keeps the no-logo content when logo %s cannot be decoded',
    async (logoUrl) => {
      const fixture = Object.values(inputs)[0];
      const service = new ReceiptsService(
        new ConfigService({ CLOUDINARY_CLOUD_NAME: 'receipt-test' }),
      );
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('broken'));
      const pdf = await service.generateSaleReceiptPdf(
        fixture.sale as never,
        {
          ...(fixture.settings as object),
          organization: { name: 'Tienda S3 Fixtures', logoUrl },
        } as never,
      );
      expect(pdf.toString('latin1')).not.toContain('/Subtype /Image');
      expect(
        normalizeExtracted((await pdfParse(new Uint8Array(pdf))).text),
      ).toBe(Object.values(baselines.expected)[0]);
    },
  );
});

describe('ReceiptsService.generateSaleReceiptPdf (golden PDF equality)', () => {
  const service = new ReceiptsService();

  const fixtureKeys = Object.keys(baselines.expected);

  it('covers all six committed fixtures', () => {
    expect(fixtureKeys).toHaveLength(6);
  });

  describe.each(fixtureKeys)('%s', (fixtureKey) => {
    it('reproduces the committed normalized extraction', async () => {
      const { sale, settings } = inputs[fixtureKey];

      const pdf = await service.generateSaleReceiptPdf(
        sale as never,
        settings as never,
      );

      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');

      // Normalize native Buffer into this realm's typed array for legacy PDF.js.
      const extracted = await pdfParse(new Uint8Array(pdf));
      expect(normalizeExtracted(extracted.text)).toBe(
        baselines.expected[fixtureKey],
      );
    });
  });
});
