import type { RiskRow } from '../types/signals.js';

/** Risk facts for a single PR — no severity judgments. */
export interface RiskFact {
  prNumber: number;
  pullRequest: string;
  author: string;
  daysOpen: number;
  relatedSentryErrors: number;
  relatedIncidents: number;
  /** Whether any correlated signals (errors or incidents) exist. */
  hasCorrelatedSignals: boolean;
}

/** Aggregated risk facts ready for LLM interpretation. */
export interface RiskFacts {
  stalePrCount: number;
  prs: RiskFact[];
}

/** Format raw risk rows into structured PR risk facts for LLM analysis. */
export function formatRiskFacts(rows: RiskRow[]): RiskFacts {
  const prs: RiskFact[] = rows.map((row) => ({
    prNumber: row.pr_number,
    pullRequest: row.pull_request,
    author: row.author,
    daysOpen: row.days_open,
    relatedSentryErrors: row.related_sentry_errors,
    relatedIncidents: row.related_incidents,
    hasCorrelatedSignals: row.related_sentry_errors > 0 || row.related_incidents > 0,
  }));

  return {
    stalePrCount: rows.length,
    prs,
  };
}
