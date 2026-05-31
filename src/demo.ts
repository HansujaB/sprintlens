#!/usr/bin/env node
/**
 * SprintLens — Interactive Demo
 *
 * Demonstrates all 5 report types with hardcoded sample data.
 * No Coral CLI, no Anthropic API key, no connected sources required.
 *
 * Run after building:
 *   npm run build && node dist/demo.js
 *
 * Or add to package.json scripts:
 *   "demo": "npm run build --silent && node dist/demo.js"
 */

import { formatManagerReport, formatEmployeeDigest, formatExecutiveReport, formatDoraReport } from './utils/formatting.js';
import { formatVelocityFacts } from './analysis/velocity.js';
import { formatWorkloadFacts } from './analysis/workload.js';
import { formatBottleneckFacts } from './analysis/bottlenecks.js';
import { formatRiskFacts } from './analysis/risks.js';
import { extractDoraSignals } from './analysis/rootCause.js';
import type { VelocityRow, LoadRow, RiskRow, DoraMetricRow } from './types/signals.js';
import type { ReportMetadata, ManagerReport, EmployeeDigest, ExecutiveReport } from './types/report.js';

// ─── Hardcoded sample Coral facts ────────────────────────────────────────────
// Simulates what would come back from real Coral SQL queries against
// GitHub + Linear + Sentry + PagerDuty for a 5-person Backend team.

const VELOCITY_ROWS: VelocityRow[] = [
  { engineer: 'alice@company.com',   issues_completed_30d: 6,  avg_cycle_days: 7.1, prs_merged_30d: 4, avg_pr_review_hrs: 19.2 },
  { engineer: 'bob@company.com',     issues_completed_30d: 8,  avg_cycle_days: 3.8, prs_merged_30d: 7, avg_pr_review_hrs: 8.4  },
  { engineer: 'charlie@company.com', issues_completed_30d: 5,  avg_cycle_days: 4.0, prs_merged_30d: 5, avg_pr_review_hrs: 9.1  },
  { engineer: 'diana@company.com',   issues_completed_30d: 7,  avg_cycle_days: 3.5, prs_merged_30d: 6, avg_pr_review_hrs: 7.8  },
  { engineer: 'evan@company.com',    issues_completed_30d: 3,  avg_cycle_days: 5.2, prs_merged_30d: 2, avg_pr_review_hrs: 14.0 },
];

const LOAD_ROWS: LoadRow[] = [
  { engineer: 'alice@company.com',   active_linear_issues: 6,  open_prs: 2, unresolved_sentry_errors: 0, pagerduty_incidents_30d: 1,  load_score: 15 },
  { engineer: 'bob@company.com',     active_linear_issues: 9,  open_prs: 4, unresolved_sentry_errors: 3, pagerduty_incidents_30d: 8,  load_score: 45 },
  { engineer: 'charlie@company.com', active_linear_issues: 5,  open_prs: 3, unresolved_sentry_errors: 1, pagerduty_incidents_30d: 2,  load_score: 19 },
  { engineer: 'diana@company.com',   active_linear_issues: 4,  open_prs: 2, unresolved_sentry_errors: 0, pagerduty_incidents_30d: 1,  load_score: 13 },
  { engineer: 'evan@company.com',    active_linear_issues: 7,  open_prs: 1, unresolved_sentry_errors: 2, pagerduty_incidents_30d: 3,  load_score: 24 },
];

const RISK_ROWS: RiskRow[] = [
  { pull_request: 'refactor payment service auth',  author: 'alice@company.com',   pr_number: 483, days_open: 9,  related_sentry_errors: 4, related_incidents: 1, risk_score: 38 },
  { pull_request: 'update auth middleware',          author: 'evan@company.com',    pr_number: 491, days_open: 6,  related_sentry_errors: 0, related_incidents: 0, risk_score: 6  },
  { pull_request: 'migrate database connection pool', author: 'bob@company.com',   pr_number: 477, days_open: 4,  related_sentry_errors: 1, related_incidents: 0, risk_score: 8  },
];

const DORA_ROWS: DoraMetricRow[] = [
  { metric: 'deployment_frequency',  measurement_type: 'proxy_pr_merges',                    value_per_week: 3.2,  unit: 'deploys/week' },
  { metric: 'lead_time_for_changes', measurement_type: 'linear_created_to_pr_merged',         value_per_week: 18.0, unit: 'hours'        },
  { metric: 'change_failure_rate',   measurement_type: 'pr_to_incident_within_48h',           value_per_week: 8.0,  unit: 'percent'      },
  { metric: 'mttr',                  measurement_type: 'pagerduty_incident_created_to_resolved', value_per_week: 4.0, unit: 'hours'       },
];

// ─── Derived facts (same pipeline that LLM receives) ─────────────────────────

const velocity  = formatVelocityFacts(VELOCITY_ROWS);
const workload  = formatWorkloadFacts(LOAD_ROWS);
const bottlenecks = formatBottleneckFacts(VELOCITY_ROWS, LOAD_ROWS);
const risks     = formatRiskFacts(RISK_ROWS);
const dora      = extractDoraSignals(DORA_ROWS);

// ─── Shared metadata ──────────────────────────────────────────────────────────

const META: ReportMetadata = {
  teamName: 'Backend',
  generatedAt: 'May 31, 2026',
  periodDays: 30,
  sourcesQueried: ['github', 'linear', 'sentry', 'pagerduty'],
  sourcesMissing: ['slack'],
};

// ─── Simulated LLM analysis output ───────────────────────────────────────────
// In production this comes from analyzeWithLLM() → Claude API.
// Here it is hardcoded to show exactly what Claude would return.

const ANALYSIS = {
  signals: {
    velocity: [
      { kind: 'velocity' as const, metric: 'cycle_time' as const, engineer: 'alice@company.com', value: 7.1, teamAverage: 4.1, deviationPct: 73, severity: 'critical' as const, description: 'Alice cycle time 7.1d — 73% above team average of 4.1d. Longest in team.' },
      { kind: 'velocity' as const, metric: 'pr_review_time' as const, value: 19.2, teamAverage: 11.7, deviationPct: 64, severity: 'elevated' as const, description: 'Team PR review time 19.2 hrs avg — up significantly, suggesting a review bottleneck.' },
    ],
    review: [
      { kind: 'review' as const, metric: 'review_concentration' as const, value: 40, severity: 'elevated' as const, description: 'Alice holds 40% of open PRs. Review load is concentrated — creating a single point of failure.', engineer: 'alice@company.com', concentrationPct: 40 },
    ],
    workload: [
      { kind: 'workload' as const, engineer: 'bob@company.com', activeIssues: 9, openPrs: 4, sentryErrors: 3, pagerdutyIncidents: 8, overloadSignalCount: 4, severity: 'critical' as const, description: 'Bob: 9 issues + 4 PRs + 8 PD pages this month. All four load signals elevated — clear burnout risk.' },
      { kind: 'workload' as const, engineer: 'evan@company.com', activeIssues: 7, openPrs: 1, sentryErrors: 2, pagerdutyIncidents: 3, overloadSignalCount: 2, severity: 'elevated' as const, description: 'Evan: 7 active issues and 14h review time. Context switching likely causing velocity drag.' },
    ],
    risk: [
      { kind: 'risk' as const, pullRequest: 'refactor payment service auth', prNumber: 483, author: 'alice@company.com', daysOpen: 9, relatedSentryErrors: 4, relatedIncidents: 1, severity: 'critical' as const, description: 'PR #483 open 9 days with 4 correlated Sentry errors and 1 incident. Highest risk in team.' },
      { kind: 'risk' as const, pullRequest: 'update auth middleware', prNumber: 491, author: 'evan@company.com', daysOpen: 6, relatedSentryErrors: 0, relatedIncidents: 0, severity: 'elevated' as const, description: 'PR #491 open 6 days with no reviewers assigned.' },
    ],
    incident: [
      { kind: 'incident' as const, engineer: 'bob@company.com', incidentCount30d: 8, severity: 'critical' as const, description: 'Bob: 8 PagerDuty pages in 30 days — 3× team average. On-call load reducing delivery capacity.' },
    ],
    dora,
  },
  rootCauses: [
    {
      type: 'review_bottleneck' as const,
      title: 'PR Review Bottleneck',
      summary: 'Alice is the primary reviewer across the team while also carrying a high cycle time. Her review queue is blocking others from merging.',
      evidence: [
        { signalKind: 'review', description: 'Alice holds 40% of open PRs', value: 40 },
        { signalKind: 'velocity', description: 'Team review time increased to 19.2 hrs', value: 19.2 },
      ],
      confidence: 'high' as const,
      affectedEngineers: ['alice@company.com', 'evan@company.com'],
    },
    {
      type: 'incident_interference' as const,
      title: 'On-call Interference for Bob',
      summary: 'Bob has 8 PagerDuty incidents — 3× team average. On-call load is directly reducing his sprint delivery capacity.',
      evidence: [
        { signalKind: 'incident', description: 'Bob: 8 PD incidents in 30 days', value: 8 },
        { signalKind: 'workload', description: 'Bob: 9 active issues + 4 open PRs concurrently', value: 9 },
      ],
      confidence: 'high' as const,
      affectedEngineers: ['bob@company.com'],
      affectedSystems: ['payment-service', 'backend-api'],
    },
  ],
  recommendations: [
    { id: 'r1', rootCause: 'review_bottleneck' as const, action: 'Redistribute PR review assignments — designate Charlie or Diana as primary reviewer for PRs currently in Alice\'s queue.', expectedImpact: 'Reduce review latency from 19h to <10h within one sprint.', priority: 'high' as const, assignee: 'alice@company.com' },
    { id: 'r2', rootCause: 'incident_interference' as const, action: 'Move Bob off primary on-call for next sprint. Redistribute 3 of his 9 active issues to Evan or Diana.', expectedImpact: 'Free ~30% of Bob\'s capacity for feature delivery.', priority: 'high' as const, assignee: 'bob@company.com' },
    { id: 'r3', rootCause: 'review_bottleneck' as const, action: 'Triage PR #483 today — 9 days open with 4 Sentry errors. Assign a second reviewer and agree on a merge-or-close decision.', expectedImpact: 'Eliminate highest-risk stale PR before it causes another incident.', priority: 'high' as const, assignee: 'alice@company.com' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function section(title: string): void {
  const divider = '─'.repeat(55);
  console.log('\n' + divider);
  console.log(`  ${title}`);
  console.log(divider + '\n');
}

function pause(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ─── Demo ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│          S P R I N T L E N S   D E M O              │');
  console.log('│   Engineering team health · All features preview     │');
  console.log('│   Team: Backend · 5 engineers · Last 30 days         │');
  console.log('└─────────────────────────────────────────────────────┘');
  console.log('\n  Sources: GitHub · Linear · Sentry · PagerDuty');
  console.log('  (Demo mode — no Coral CLI or API key required)\n');

  await pause(400);

  // ── 1. DRYRUN ──────────────────────────────────────────────────────────────
  section('1 / 5   sprintlens dryrun   (no LLM — raw Coral facts)');

  console.log('Running Coral queries...\n');
  await pause(300);

  const dryrunOutput = {
    team: META.teamName,
    sources: { connected: META.sourcesQueried, missing: META.sourcesMissing },
    facts: {
      velocity: {
        teamAvgCycleDays: velocity.teamAvgCycleDays.toFixed(1),
        teamAvgReviewHrs: velocity.teamAvgReviewHrs.toFixed(1),
        engineers: velocity.engineers,
      },
      workload: {
        teamSize: workload.teamSize,
        teamAvgActiveIssues: workload.teamAvgActiveIssues.toFixed(1),
        engineers: workload.engineers,
      },
      bottlenecks: {
        totalOpenPrs: bottlenecks.totalOpenPrs,
        prConcentration: bottlenecks.prConcentration,
      },
      risks: {
        stalePrCount: risks.stalePrCount,
        prs: risks.prs,
      },
      dora: dora.map((d) => ({ metric: d.metric, value: d.value, tier: d.tier })),
    },
  };

  console.log(JSON.stringify(dryrunOutput, null, 2));
  await pause(600);

  // ── 2. DORA ────────────────────────────────────────────────────────────────
  section('2 / 5   sprintlens dora   (deterministic DORA tiers · no LLM)');
  await pause(300);

  console.log(formatDoraReport(
    META.teamName,
    META.periodDays,
    dora,
    META.sourcesQueried,
    META.sourcesMissing,
  ));
  await pause(600);

  // ── 3. REPORT ──────────────────────────────────────────────────────────────
  section('3 / 5   sprintlens report   (manager sprint health · LLM-enriched)');
  console.log('  Running LLM analysis [analyzeWithLLM]...');
  await pause(500);
  console.log('  Generating manager report [generateManagerReport]...\n');
  await pause(400);

  const managerReport: ManagerReport = {
    type: 'manager',
    metadata: META,
    signals: ANALYSIS.signals,
    rootCauses: ANALYSIS.rootCauses,
    recommendations: ANALYSIS.recommendations,
    summary: 'Backend team velocity is below target this sprint. Two critical signals — review bottleneck on Alice and on-call overload on Bob — are the primary drivers. PR #483 (payment service) is the highest immediate risk with 4 correlated Sentry errors after 9 days open.',
    velocitySection: 'Average cycle time 4.1 days. Alice at 7.1 days (73% above avg) — the outlier. PR review time team-wide increased to 19.2 hrs, up from 8.4 hrs last sprint, consistent with a review queue bottleneck.',
    loadSection: 'Bob: 9 active issues, 4 open PRs, 3 Sentry errors, 8 PD incidents this month — all four load signals elevated. Evan carries 7 active issues with above-average review time — monitor next sprint.',
    risksSection: '• PR #483 "refactor payment service auth" — open 9 days, 4 correlated Sentry errors, 1 incident. Triage today.\n• PR #491 "update auth middleware" — open 6 days, no reviewers assigned. Assign now.',
  };

  console.log(formatManagerReport(managerReport));
  await pause(600);

  // ── 4. DIGEST ──────────────────────────────────────────────────────────────
  section('4 / 5   sprintlens digest --engineer alice   (private engineer digest · LLM)');
  console.log('  Generating digest for alice@company.com...\n');
  await pause(400);

  const digest: EmployeeDigest = {
    type: 'employee',
    metadata: META,
    engineerName: 'Alice',
    summary: "Hey Alice 👋 — you've had a busy sprint. Your cycle time of 7.1 days stands out (team avg is 4.1 days), and you're holding a significant share of the team's open PRs for review. There's no performance concern here — this pattern usually means external blockers or review queue buildup. Let's clear it.",
    currentWorkload: [
      { category: 'workload', description: '6 active issues in progress — at team average' },
      { category: 'workload', description: '2 open PRs authored — #483 is 9 days old and needs a decision' },
    ],
    blockers: [
      { category: 'blocker', description: 'PR #483 "refactor payment service auth" open 9 days — 4 Sentry errors correlated. Needs a second reviewer or close decision today.' },
      { category: 'blocker', description: 'You are primary reviewer on 40% of team open PRs — this is creating a dependency bottleneck for others.' },
    ],
    suggestedActions: [
      { category: 'action', description: 'Pair with Charlie or Diana on PR #483 today — agree merge or close.' },
      { category: 'action', description: 'Ask eng manager to redistribute 2 review assignments from your queue this week.' },
    ],
    rootCauses: [ANALYSIS.rootCauses[0]],
  };

  console.log(formatEmployeeDigest(digest));
  await pause(600);

  // ── 5. EXECUTIVE ───────────────────────────────────────────────────────────
  section('5 / 5   sprintlens executive   (leadership summary · LLM · no engineer names)');
  console.log('  Generating executive report...\n');
  await pause(400);

  const executive: ExecutiveReport = {
    type: 'executive',
    metadata: META,
    deliveryConfidence: 'medium',
    summary: 'Engineering velocity is below target this sprint driven by two systemic patterns: a review queue bottleneck and concentrated on-call load. Both are resolvable without headcount changes.',
    velocityTrend: 'Avg cycle time 4.1 days vs 3.2 days last sprint (+28%). PR review latency doubled to 19 hrs. Two engineers are operating at elevated load — one critically so.',
    engineeringRisk: 'One stale PR with correlated production errors represents near-term delivery risk. Change failure rate at 8% (High tier) warrants tracking. MTTR 4 hrs is acceptable.',
    rootCauses: ANALYSIS.rootCauses,
    recommendations: ANALYSIS.recommendations,
    doraSummary: 'Deployment Frequency: Medium · Lead Time: High · CFR: High (8%) · MTTR: High (4h). Recommend targeting Elite on Lead Time by clearing review bottleneck.',
  };

  console.log(formatExecutiveReport(executive));

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('\n');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│                   Demo complete                      │');
  console.log('│                                                      │');
  console.log('│  To run for real:                                    │');
  console.log('│    1. coral source add --interactive github          │');
  console.log('│    2. coral source add --interactive linear          │');
  console.log('│    3. cp sprintlens.toml.example sprintlens.toml     │');
  console.log('│    4. export ANTHROPIC_API_KEY=sk-ant-...            │');
  console.log('│    5. sprintlens report                              │');
  console.log('└─────────────────────────────────────────────────────┘');
  console.log('');
}

main().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
