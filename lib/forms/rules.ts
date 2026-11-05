/**
 * Field rules shared by the server (app/api/submit) and the dashboard display.
 * The same Medicare and date rules run in the browser (public/assets/site.js), so a
 * patient sees the problem before sending; the server repeats every check so a
 * submission that skips the browser is still rejected.
 */

/**
 * Dates. A native date box (<input type="date">) always sends yyyy-mm-dd whatever the
 * patient sees on screen (dd/mm/yyyy in Australia), and the practice was receiving that
 * raw value. Every date is turned into dd/mm/yyyy once, when the form arrives, so the
 * email, the dashboard and the CSV export all get the same Australian date. Browsers
 * without a date box send what the patient typed, so d/m/yyyy is accepted too.
 * Returns '' for an empty value and null when the value is not a real date.
 */
export function toAuDate(value: string): string | null {
  const s = String(value || '').trim();
  if (!s) return '';
  let d: number, m: number, y: number;
  let x = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (x) [y, m, d] = [Number(x[1]), Number(x[2]), Number(x[3])];
  else if ((x = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(s))) [d, m, y] = [Number(x[1]), Number(x[2]), Number(x[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || y < 1900) return null;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** A dd/mm/yyyy date that is not after today (Australia/Brisbane). */
export function notInFuture(au: string): boolean {
  const [d, m, y] = au.split('/').map(Number);
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Brisbane' }));
  return Date.UTC(y, m - 1, d) <= Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
}

/** "NA" (any case, or N/A) for patients without a Medicare card. */
export const isNA = (v: string) => /^n\/?a$/i.test(String(v || '').trim());

/**
 * A Medicare card number: 10 digits as printed on the card (spaces allowed), or 11 with
 * the patient's reference number on the end. The first digit is 2 to 6 and the ninth is a
 * check digit, so most typing mistakes are caught.
 */
export function isMedicareNumber(v: string): boolean {
  const n = String(v || '').replace(/[\s-]/g, '');
  if (!/^\d{10,11}$/.test(n) || !/^[2-6]/.test(n)) return false;
  const w = [1, 3, 7, 9, 1, 3, 7, 9];
  const sum = w.reduce((t, k, i) => t + k * Number(n[i]), 0);
  return sum % 10 === Number(n[8]);
}

/** The patient's reference number on the card: 1 to 9. */
export const isMedicareRef = (v: string) => /^[1-9]$/.test(String(v || '').trim());
