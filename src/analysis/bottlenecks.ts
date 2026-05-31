import type { LoadRow, VelocityRow } from '../types/signals.js';

/** PR concentration fact for a single engineer — no severity judgments. */
export interface PrConcentrationFact {
  engineer: string;
  openPrs: number;
  /** Fraction of all team open PRs owned by this engineer (0–100). */
  concentrationPct: number;
}

/** Aggregated bottleneck-related facts ready for LLM interpretation. */
export interface BottleneckFacts {
  totalOpenPrs: number;
  teamAvgReviewHrs: number;
  /** Per-engineer PR concentration breakdown. */
  prConcentration: PrConcentrationFact[];
}

/** Format velocity and load rows into review/bottleneck facts for LLM analysis. */
export function formatBottleneckFacts(velocity: VelocityRow[], load: LoadRow[]): BottleneckFacts {
  const totalOpenPrs = load.reduce((sum, r) => sum + r.open_prs, 0);

  const prConcentration: PrConcentrationFact[] = load.map((row) => ({
    engineer: row.engineer,
    openPrs: row.open_prs,
    concentrationPct:
      totalOpenPrs > 0 ? Math.round((row.open_prs / totalOpenPrs) * 100) : 0,
  }));

  const reviewHrsValues = velocity.map((r) => r.avg_pr_review_hrs).filter((v) => v > 0);
  const teamAvgReviewHrs =
    reviewHrsValues.length > 0
      ? reviewHrsValues.reduce((a, b) => a + b, 0) / reviewHrsValues.length
      : 0;

  return {
    totalOpenPrs,
    teamAvgReviewHrs,
    prConcentration,
  };
}
