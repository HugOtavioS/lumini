const LOCALE = 'pt-BR';

const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function formatCurrency(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
    .format(value)
    .replace(/ /g, ' ');
}

export function formatNumber(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Converte texto digitado ("0,85", "1.290,50") em número; NaN se inválido. */
export function parseDecimal(text: string): number {
  const normalized = text.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (normalized === '') return Number.NaN;
  return Number(normalized);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatDateShort(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')} ${monthsShort[date.getMonth()]}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "Hoje, 14:20", "Ontem" ou "24 Set". */
export function formatRelativeDay(iso: string, withTime = false, now = new Date()): string {
  const date = new Date(iso);
  if (isSameDay(date, now)) return withTime ? `Hoje, ${formatTime(date)}` : 'Hoje';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Ontem';
  return formatDateShort(date);
}

/** "há 15 min", "há 2 h", "há 3 dias". */
export function formatElapsed(iso: string, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

export function addDays(iso: string, days: number): Date {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function slugifyFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
    .replace(/[^A-Za-z0-9]/g, '');
}

export function maskPhone(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function maskCep(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

let idCounter = 0;
/** Identificador gerado no dispositivo (RF02, 3.1). */
export function generateId(): string {
  idCounter += 1;
  const random = Math.random().toString(16).slice(2, 10);
  return `${Date.now().toString(16)}-${idCounter.toString(16)}-${random}`;
}
