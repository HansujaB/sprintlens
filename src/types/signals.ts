/** Connected Coral source schemas. */
export type CoralSource =
  | 'github'
  | 'linear'
  | 'sentry'
  | 'pagerduty'
  | 'slack';

/** Row shape returned by velocity.sql — facts only, no reasoning. */
export interface VelocityRow {
  engineer: string;
  issues_completed_30d: number;
  avg_cycle_days: number;
  prs_merged_30d: number;
  avg_pr_review_hrs: number;
}

/** Row shape returned by load.sql — raw counts per engineer. */
export interface LoadRow {
  engineer: string;
  active_linear_issues: number;
  open_prs: number;
  unresolved_sentry_errors: number;
  pagerduty_incidents_30d: number;
}

/** Row shape returned by risks.sql — stale PR facts with correlated error counts. */
export interface RiskRow {
  pull_request: string;
  author: string;
  pr_number: number;
  days_open: number;
  related_sentry_errors: number;
  related_incidents: number;
}

/** DORA metric identifiers matching dora.sql output. */
export type DoraMetricName =
  | 'deployment_frequency'
  | 'lead_time_for_changes'
  | 'change_failure_rate'
  | 'mttr';

/** Row shape returned by dora.sql — one row per metric. */
export interface DoraMetricRow {
  metric: DoraMetricName;
  measurement_type: string;
  value_per_week: number;
  unit: string;
}

/** Aggregated raw facts from all Coral queries. */
export interface CoralFacts {
  velocity: VelocityRow[];
  load: LoadRow[];
  risks: RiskRow[];
  dora: DoraMetricRow[];
}

/** Metadata about which Coral sources were available during a run. */
export interface CoralSourceStatus {
  connected: CoralSource[];
  missing: CoralSource[];
}

/** Severity tier for a detected signal. */
export type SignalSeverity = 'normal' | 'elevated' | 'critical';

export interface VelocitySignal {
  kind: 'velocity';
  metric: 'cycle_time' | 'pr_review_time' | 'issues_completed' | 'prs_merged';
  engineer?: string;
  value: number;
  teamAverage?: number;
  deviationPct?: number;
  severity: SignalSeverity;
  description: string;
}

export interface ReviewSignal {
  kind: 'review';
  metric: 'review_latency' | 'review_concentration' | 'open_prs';
  value: number;
  threshold?: number;
  severity: SignalSeverity;
  description: string;
  engineer?: string;
  concentrationPct?: number;
}

export interface WorkloadSignal {
  kind: 'workload';
  engineer: string;
  activeIssues: number;
  openPrs: number;
  sentryErrors: number;
  pagerdutyIncidents: number;
  overloadSignalCount: number;
  severity: SignalSeverity;
  description: string;
}

export interface RiskSignal {
  kind: 'risk';
  pullRequest: string;
  prNumber: number;
  author: string;
  daysOpen: number;
  relatedSentryErrors: number;
  relatedIncidents: number;
  severity: SignalSeverity;
  description: string;
}

export interface IncidentSignal {
  kind: 'incident';
  engineer?: string;
  incidentCount30d: number;
  severity: SignalSeverity;
  description: string;
}

export type DoraTier = 'elite' | 'high' | 'medium' | 'low' | 'unavailable';

export interface DoraSignal {
  kind: 'dora';
  metric: DoraMetricName;
  value: number;
  unit: string;
  measurementType: string;
  tier: DoraTier;
  severity: SignalSeverity;
  description: string;
}

export type Signal =
  | VelocitySignal
  | ReviewSignal
  | WorkloadSignal
  | RiskSignal
  | IncidentSignal
  | DoraSignal;

export interface SignalCollection {
  velocity: VelocitySignal[];
  review: ReviewSignal[];
  workload: WorkloadSignal[];
  risk: RiskSignal[];
  incident: IncidentSignal[];
  dora: DoraSignal[];
}

export function flattenSignals(signals: SignalCollection): Signal[] {
  return [
    ...signals.velocity,
    ...signals.review,
    ...signals.workload,
    ...signals.risk,
    ...signals.incident,
    ...signals.dora,
  ];
}

/** Supported root cause categories. */
export type RootCauseType =
  | 'review_bottleneck'
  | 'ownership_bottleneck'
  | 'incident_interference'
  | 'context_switching'
  | 'sprint_scope_creep'
  | 'knowledge_concentration';

export type RootCauseConfidence = 'low' | 'medium' | 'high';

export interface RootCauseEvidence {
  signalKind: string;
  description: string;
  value?: number | string;
}

export interface RootCause {
  type: RootCauseType;
  title: string;
  summary: string;
  evidence: RootCauseEvidence[];
  confidence: RootCauseConfidence;
  affectedEngineers?: string[];
  affectedSystems?: string[];
}

export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface Recommendation {
  id: string;
  rootCause: RootCauseType;
  action: string;
  expectedImpact: string;
  priority: RecommendationPriority;
  assignee?: string;
}

/** Output of the full deterministic analysis pipeline. */
export interface AnalysisResult {
  signals: SignalCollection;
  rootCauses: RootCause[];
  recommendations: Recommendation[];
}

/** Input to the analysis engine. */
export interface AnalysisInput {
  facts: CoralFacts;
  sourceStatus: CoralSourceStatus;
  periodDays: number;
}
