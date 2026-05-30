import type { RiskRow, RiskSignal } from '../types/signals.js';
import { ANALYSIS_THRESHOLDS } from '../coral/schema.js';

/** Extract delivery risk signals from stale PR rows. */
export function extractRiskSignals(rows: RiskRow[]): RiskSignal[] {
  return rows.map((row) => {
    const hasErrors = row.related_sentry_errors > 0 || row.related_incidents > 0;
    let severity: RiskSignal['severity'] = 'elevated';

    if (row.days_open >= ANALYSIS_THRESHOLDS.criticalPrDays && hasErrors) {
      severity = 'critical';
    } else if (row.days_open >= ANALYSIS_THRESHOLDS.criticalPrDays) {
      severity = 'elevated';
    } else if (hasErrors) {
      severity = 'critical';
    }

    const parts = [`open ${row.days_open} days`];
    if (row.related_sentry_errors > 0) {
      parts.push(`${row.related_sentry_errors} correlated Sentry errors`);
    }
    if (row.related_incidents > 0) {
      parts.push(`${row.related_incidents} related incidents`);
    }

    return {
      kind: 'risk',
      pullRequest: row.pull_request,
      prNumber: row.pr_number,
      author: row.author,
      daysOpen: row.days_open,
      relatedSentryErrors: row.related_sentry_errors,
      relatedIncidents: row.related_incidents,
      severity,
      description: `PR #${row.pr_number} "${row.pull_request}" — ${parts.join(', ')}`,
    };
  });
}
