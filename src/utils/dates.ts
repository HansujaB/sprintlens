/** ISO timestamp for report metadata. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Human-readable date for report headers. */
export function formatReportDate(date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Default analysis window in days. */
export const DEFAULT_PERIOD_DAYS = 30;
