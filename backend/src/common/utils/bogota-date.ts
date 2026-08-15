import { BadRequestException } from '@nestjs/common';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_ONLY_REGEX = /^\d{4}-\d{2}$/;
const BOGOTA_OFFSET_UTC_HOURS = 5;

const bogotaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function parseDateOnly(value: string): [number, number, number] | null {
  if (!DATE_ONLY_REGEX.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return [year, month, day];
}

export function parseBogotaStartOfDay(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parts = parseDateOnly(value);
  if (parts) {
    const [year, month, day] = parts;
    return new Date(
      Date.UTC(year, month - 1, day, BOGOTA_OFFSET_UTC_HOURS, 0, 0, 0),
    );
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseBogotaEndOfDay(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parts = parseDateOnly(value);
  if (parts) {
    const [year, month, day] = parts;
    return new Date(
      Date.UTC(year, month - 1, day + 1, BOGOTA_OFFSET_UTC_HOURS, 0, 0, 0) - 1,
    );
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  date.setHours(23, 59, 59, 999);
  return date;
}

export function formatDateInBogota(date: Date): string {
  const parts = bogotaDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return date.toISOString().split('T')[0];
  }

  return `${year}-${month}-${day}`;
}

export function parseBogotaMonthRange(month: string): {
  start: Date;
  end: Date;
} {
  if (!MONTH_ONLY_REGEX.test(month ?? '')) {
    throw new BadRequestException('El formato del mes debe ser YYYY-MM');
  }

  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(
    Date.UTC(year, monthIndex - 1, 1, BOGOTA_OFFSET_UTC_HOURS, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(year, monthIndex, 1, BOGOTA_OFFSET_UTC_HOURS, 0, 0, 0) - 1,
  );

  return { start, end };
}
