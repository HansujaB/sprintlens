import type { LoadRow } from '../types/signals.js';

/** Per-engineer load facts — no severity judgments. */
export interface LoadFact {
  engineer: string;
  activeLinearIssues: number;
  openPrs: number;
  unresolvedSentryErrors: number;
  pagerdutyIncidents30d: number;
  /** How each engineer's total load compares to team average (0 = at average). */
  loadIndexVsTeam: number | null;
}

/** Aggregated workload facts ready for LLM interpretation. */
export interface WorkloadFacts {
  teamSize: number;
  teamAvgActiveIssues: number;
  teamAvgOpenPrs: number;
  teamAvgIncidents30d: number;
  engineers: LoadFact[];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Format raw load rows into structured workload facts for LLM analysis. */
export function formatWorkloadFacts(rows: LoadRow[]): WorkloadFacts {
  const teamAvgActiveIssues = avg(rows.map((r) => r.active_linear_issues));
  const teamAvgOpenPrs = avg(rows.map((r) => r.open_prs));
  const teamAvgIncidents30d = avg(rows.map((r) => r.pagerduty_incidents_30d));

  // Normalised "load index": average of per-metric ratios vs team mean.
  const engineers: LoadFact[] = rows.map((row) => {
    const ratios: number[] = [];
    if (teamAvgActiveIssues > 0) ratios.push(row.active_linear_issues / teamAvgActiveIssues);
    if (teamAvgOpenPrs > 0) ratios.push(row.open_prs / teamAvgOpenPrs);
    if (teamAvgIncidents30d > 0) ratios.push(row.pagerduty_incidents_30d / teamAvgIncidents30d);
    const loadIndex = ratios.length > 0 ? avg(ratios) - 1 : null; // positive = above avg

    return {
      engineer: row.engineer,
      activeLinearIssues: row.active_linear_issues,
      openPrs: row.open_prs,
      unresolvedSentryErrors: row.unresolved_sentry_errors,
      pagerdutyIncidents30d: row.pagerduty_incidents_30d,
      loadIndexVsTeam: loadIndex !== null ? Math.round(loadIndex * 100) / 100 : null,
    };
  });

  return {
    teamSize: rows.length,
    teamAvgActiveIssues,
    teamAvgOpenPrs,
    teamAvgIncidents30d,
    engineers,
  };
}
