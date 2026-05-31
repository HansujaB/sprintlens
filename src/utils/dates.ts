/** ISO timestamp for report metadata. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Human-readable date for report headers. */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatReportDate(date = new Date()): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Default analysis window in days. */
export const DEFAULT_PERIOD_DAYS = 30;
