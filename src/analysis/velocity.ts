import type { VelocityRow } from '../types/signals.js';

/** Computed velocity facts for a single engineer — no severity judgments. */
export interface VelocityFact {
  engineer: string;
  avgCycleDays: number;
  prs_merged_30d: number;
  avg_pr_review_hrs: number;
  issues_completed_30d: number;
  /** Deviation from team average cycle time, as a percentage. Positive = slower. */
  cycleDeviationPct: number | null;
}

/** Aggregated velocity facts ready for LLM interpretation. */
export interface VelocityFacts {
  teamAvgCycleDays: number;
  teamAvgReviewHrs: number;
  engineers: VelocityFact[];
}

function average(rows: VelocityRow[], field: keyof VelocityRow): number {
  const values = rows
    .map((r) => r[field])
    .filter((v): v is number => typeof v === 'number' && v > 0);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Format raw velocity rows into structured facts for LLM analysis. */
export function formatVelocityFacts(rows: VelocityRow[]): VelocityFacts {
  const teamAvgCycleDays = average(rows, 'avg_cycle_days');
  const teamAvgReviewHrs = average(rows, 'avg_pr_review_hrs');

  const engineers: VelocityFact[] = rows.map((row) => {
    const cycleDeviationPct =
      teamAvgCycleDays > 0 && row.avg_cycle_days > 0
        ? ((row.avg_cycle_days - teamAvgCycleDays) / teamAvgCycleDays) * 100
        : null;

    return {
      engineer: row.engineer,
      avgCycleDays: row.avg_cycle_days,
      prs_merged_30d: row.prs_merged_30d,
      avg_pr_review_hrs: row.avg_pr_review_hrs,
      issues_completed_30d: row.issues_completed_30d,
      cycleDeviationPct: cycleDeviationPct !== null ? Math.round(cycleDeviationPct) : null,
    };
  });

  return { teamAvgCycleDays, teamAvgReviewHrs, engineers };
}
