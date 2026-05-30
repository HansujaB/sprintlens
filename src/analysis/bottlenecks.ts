import type { LoadRow, ReviewSignal, VelocityRow } from '../types/signals.js';
import { ANALYSIS_THRESHOLDS } from '../coral/schema.js';

/** Detect review bottlenecks and ownership concentration. */
export function extractBottleneckSignals(
  velocity: VelocityRow[],
  load: LoadRow[],
): ReviewSignal[] {
  const signals: ReviewSignal[] = [];

  const totalOpenPrs = load.reduce((sum, r) => sum + r.open_prs, 0);
  if (totalOpenPrs > 0) {
    for (const row of load) {
      if (row.open_prs === 0) continue;
      const concentrationPct = (row.open_prs / totalOpenPrs) * 100;
      if (concentrationPct >= ANALYSIS_THRESHOLDS.reviewConcentrationPct) {
        signals.push({
          kind: 'review',
          metric: 'review_concentration',
          value: row.open_prs,
          concentrationPct,
          engineer: row.engineer,
          severity: concentrationPct >= 60 ? 'critical' : 'elevated',
          description: `${row.engineer} owns ${concentrationPct.toFixed(0)}% of open PRs (${row.open_prs}/${totalOpenPrs})`,
        });
      }
    }
  }

  const avgReview =
    velocity.reduce((s, r) => s + r.avg_pr_review_hrs, 0) / Math.max(velocity.length, 1);

  if (avgReview >= ANALYSIS_THRESHOLDS.elevatedReviewHrs) {
    signals.push({
      kind: 'review',
      metric: 'review_latency',
      value: avgReview,
      threshold: ANALYSIS_THRESHOLDS.elevatedReviewHrs,
      severity: avgReview >= 48 ? 'critical' : 'elevated',
      description: `Team average PR review latency is ${avgReview.toFixed(0)} hours`,
    });
  }

  return signals;
}
