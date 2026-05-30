import type {
  DoraMetricRow,
  DoraSignal,
  RootCause,
  SignalCollection,
} from '../types/signals.js';
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

/** Classify DORA metrics into signals. */
export function extractDoraSignals(rows: DoraMetricRow[]): DoraSignal[] {
  return rows.map((row) => {
    let tier: DoraSignal['tier'] = 'unavailable';
    let severity: DoraSignal['severity'] = 'normal';

    switch (row.metric) {
      case 'lead_time_for_changes':
        tier = classifyLeadTime(row.value_per_week);
        severity = tier === 'low' ? 'elevated' : 'normal';
        break;
      case 'change_failure_rate':
        tier = classifyFailureRate(row.value_per_week);
        severity = tier === 'low' ? 'elevated' : 'normal';
        break;
      case 'mttr':
        tier = classifyMttr(row.value_per_week);
        severity = tier === 'low' ? 'elevated' : 'normal';
        break;
      case 'deployment_frequency':
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
      severity,
      description: `${row.metric}: ${row.value_per_week} ${row.unit} (${tier})`,
    };
  });
}

/** Derive root causes from extracted signals — deterministic reasoning layer. */
export function analyzeRootCauses(signals: SignalCollection): RootCause[] {
  const causes: RootCause[] = [];

  const reviewSignals = [...signals.review, ...signals.velocity.filter((s) => s.metric === 'pr_review_time')];
  if (reviewSignals.some((s) => s.severity !== 'normal')) {
    causes.push({
      type: 'review_bottleneck',
      title: 'Review Bottleneck',
      summary: 'PR review latency is elevated and/or review ownership is concentrated.',
      evidence: reviewSignals.map((s) => ({
        signalKind: s.kind,
        description: s.description,
        value: s.value,
      })),
      confidence: reviewSignals.some((s) => s.severity === 'critical') ? 'high' : 'medium',
      affectedEngineers: reviewSignals
        .map((s) => ('engineer' in s ? s.engineer : undefined))
        .filter((e): e is string => Boolean(e)),
    });
  }

  const concentration = signals.review.filter((s) => s.metric === 'review_concentration');
  if (concentration.length > 0) {
    causes.push({
      type: 'ownership_bottleneck',
      title: 'Ownership Bottleneck',
      summary: 'Work ownership is concentrated on a small number of engineers.',
      evidence: concentration.map((s) => ({
        signalKind: s.kind,
        description: s.description,
        value: s.concentrationPct,
      })),
      confidence: 'high',
      affectedEngineers: concentration.map((s) => s.engineer).filter(Boolean) as string[],
    });
  }

  if (signals.incident.some((s) => s.severity !== 'normal')) {
    causes.push({
      type: 'incident_interference',
      title: 'Incident Interference',
      summary: 'On-call and incident load is affecting delivery capacity.',
      evidence: signals.incident.map((s) => ({
        signalKind: s.kind,
        description: s.description,
        value: s.incidentCount30d,
      })),
      confidence: 'medium',
      affectedEngineers: signals.incident.map((s) => s.engineer).filter(Boolean) as string[],
    });
  }

  if (signals.workload.some((s) => s.activeIssues >= 4 && s.openPrs >= 2)) {
    causes.push({
      type: 'context_switching',
      title: 'Context Switching',
      summary: 'Engineers are carrying too many concurrent issues and PRs.',
      evidence: signals.workload.map((s) => ({
        signalKind: s.kind,
        description: s.description,
      })),
      confidence: 'medium',
      affectedEngineers: signals.workload.map((s) => s.engineer),
    });
  }

  if (signals.risk.length >= 3) {
    causes.push({
      type: 'sprint_scope_creep',
      title: 'Sprint Scope Creep',
      summary: 'Multiple stale PRs suggest scope is outpacing review and merge capacity.',
      evidence: signals.risk.slice(0, 5).map((s) => ({
        signalKind: s.kind,
        description: s.description,
      })),
      confidence: 'medium',
    });
  }

  if (concentration.some((s) => (s.concentrationPct ?? 0) >= 50)) {
    causes.push({
      type: 'knowledge_concentration',
      title: 'Knowledge Concentration',
      summary: 'Critical work areas depend heavily on one or two engineers.',
      evidence: concentration.map((s) => ({
        signalKind: s.kind,
        description: s.description,
        value: s.concentrationPct,
      })),
      confidence: 'high',
      affectedEngineers: concentration.map((s) => s.engineer).filter(Boolean) as string[],
    });
  }

  return causes;
}
