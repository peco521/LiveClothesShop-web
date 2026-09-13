// Parse calendar/whole seconds separately; fractional microseconds never pass through Date.
// Date is used only for Gregorian validation and exact integer milliseconds (years 1..9999).
export function microsegundosISO(value: unknown): bigint | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match || match[0] !== value) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const offsetHour = Number(match[10] ?? 0), offsetMinute = Number(match[11] ?? 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59
    || second > 59 || offsetHour > 23 || offsetMinute > 59) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day); date.setUTCHours(hour, minute, second, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const offset = (offsetHour * 60 + offsetMinute) * (match[9] === '-' ? -1 : 1);
  const utc = date.getTime() - offset * 60000;
  const utcYear = new Date(utc).getUTCFullYear();
  if (utcYear < 1 || utcYear > 9999) return null;
  return BigInt(utc) * 1000n + BigInt((match[7] ?? '').padEnd(6, '0'));
}
