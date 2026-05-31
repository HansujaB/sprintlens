import type { DoraMetricRow, DoraSignal } from '../types/signals.js';
import { DORA_BENCHMARKS } from '../coral/schema.js';

function classifyLeadTime(hours: number): DoraSignal['tier'] {
  if (hours <= DORA_BENCHMARKS.lead_time_hours.elite) return 'elite';
  if (hours <= DORA_BENCHMARKS.lead_time_hours.high) return 'high';
  if (hours <= DORA_BENCHMARKS.lead_time_hours.medium) return 'medium';
  return 'low';
}

function classifyFailureRate(pct: number): DoraSignal['tier'] {
  if (pct <= DORA_BENCHMARKS.change_failure_rate_pct.elite) return 'elite';
  if (pct <= DORA_BENCHMARKS.change_failure_rate_pct.high) return 'high';
  if (pct <= DORA_BENCHMARKS.change_failure_rate_pct.medium) return 'medium';
  return 'low';
}

function classifyMttr(hours: number): DoraSignal['tier'] {
  if (hours <= DORA_BENCHMARKS.mttr_hours.elite) return 'elite';
  if (hours <= DORA_BENCHMARKS.mttr_hours.high) return 'high';
  if (hours <= DORA_BENCHMARKS.mttr_hours.medium) return 'medium';
  return 'low';
}

/**
 * Classify DORA metrics into industry-standard tiers.
 *
 * Tier thresholds come from the DORA State of DevOps Report and are
 * deterministic by design — they are not arbitrary magic numbers.
 * Severity and interpretation of what the tier *means for this team*
 * is left to the LLM in analyzeWithLLM().
 */
export function extractDoraSignals(rows: DoraMetricRow[]): DoraSignal[] {
  return rows.map((row) => {
    let tier: DoraSignal['tier'] = 'unavailable';

    switch (row.metric) {
      case 'lead_time_for_changes':
        tier = classifyLeadTime(row.value_per_week);
        break;
      case 'change_failure_rate':
        tier = classifyFailureRate(row.value_per_week);
        break;
      case 'mttr':
        tier = classifyMttr(row.value_per_week);
        break;
      case 'deployment_frequency':
        // Thresholds: ≥5/week = high (≈daily), ≥1/week = medium, else low
        tier = row.value_per_week >= 5 ? 'high' : row.value_per_week >= 1 ? 'medium' : 'low';
        break;
    }

    return {
      kind: 'dora',
      metric: row.metric,
      value: row.value_per_week,
      unit: row.unit,
      measurementType: row.measurement_type,
      tier,
      // severity is intentionally left 'normal'; the LLM interprets DORA tiers in context
      severity: 'normal',
      description: `${row.metric}: ${row.value_per_week} ${row.unit} — tier: ${tier}`,
    };
  });
}
