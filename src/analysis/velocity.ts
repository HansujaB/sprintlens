import type { VelocityRow, VelocitySignal } from '../types/signals.js';
import { ANALYSIS_THRESHOLDS } from '../coral/schema.js';

function teamAverage(rows: VelocityRow[], field: keyof VelocityRow): number {
  const values = rows
    .map((r) => r[field])
    .filter((v): v is number => typeof v === 'number' && v > 0);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Extract velocity signals from raw Coral velocity rows. */
export function extractVelocitySignals(rows: VelocityRow[]): VelocitySignal[] {
  const signals: VelocitySignal[] = [];
  const avgCycle = teamAverage(rows, 'avg_cycle_days');
  const avgReview = teamAverage(rows, 'avg_pr_review_hrs');

  if (avgReview > ANALYSIS_THRESHOLDS.elevatedReviewHrs) {
    signals.push({
      kind: 'velocity',
      metric: 'pr_review_time',
      value: avgReview,
      teamAverage: avgReview,
      severity: 'elevated',
      description: `Team average PR review time is ${avgReview.toFixed(0)} hours`,
    });
  }

  for (const row of rows) {
    if (avgCycle > 0 && row.avg_cycle_days > 0) {
      const deviationPct = ((row.avg_cycle_days - avgCycle) / avgCycle) * 100;
      if (deviationPct >= ANALYSIS_THRESHOLDS.cycleTimeDeviationPct) {
        signals.push({
          kind: 'velocity',
          metric: 'cycle_time',
          engineer: row.engineer,
          value: row.avg_cycle_days,
          teamAverage: avgCycle,
          deviationPct,
          severity: deviationPct >= 100 ? 'critical' : 'elevated',
          description: `${row.engineer} cycle time ${row.avg_cycle_days.toFixed(1)} days (${deviationPct.toFixed(0)}% above team average)`,
        });
      }
    }
  }

  return signals;
}
