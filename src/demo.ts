#!/usr/bin/env node
/**
 * SprintLens — Interactive Demo
 *
 * Shows all 5 report types with hardcoded sample data.
 * No Coral CLI, no Anthropic API key, no connected sources required.
 *
 *   npm run demo
 */

import { formatManagerReport, formatEmployeeDigest, formatExecutiveReport, formatDoraReport } from './utils/formatting.js';
import { formatVelocityFacts } from './analysis/velocity.js';
import { formatWorkloadFacts } from './analysis/workload.js';
import { formatBottleneckFacts } from './analysis/bottlenecks.js';
import { formatRiskFacts } from './analysis/risks.js';
import { extractDoraSignals } from './analysis/rootCause.js';
import type { VelocityRow, LoadRow, RiskRow, DoraMetricRow } from './types/signals.js';
import type { ReportMetadata, ManagerReport, EmployeeDigest, ExecutiveReport } from './types/report.js';

// ─── Sample Coral facts — Backend team, 5 engineers ──────────────────────────

const VELOCITY_ROWS: VelocityRow[] = [
  { engineer: 'alice@company.com',   issues_completed_30d: 6, avg_cycle_days: 7.1, prs_merged_30d: 4, avg_pr_review_hrs: 19.2 },
  { engineer: 'bob@company.com',     issues_completed_30d: 8, avg_cycle_days: 3.8, prs_merged_30d: 7, avg_pr_review_hrs: 8.4  },
  { engineer: 'priya@company.com',   issues_completed_30d: 5, avg_cycle_days: 4.0, prs_merged_30d: 5, avg_pr_review_hrs: 9.1  },
  { engineer: 'james@company.com',   issues_completed_30d: 7, avg_cycle_days: 3.5, prs_merged_30d: 6, avg_pr_review_hrs: 7.8  },
  { engineer: 'diana@company.com',   issues_completed_30d: 3, avg_cycle_days: 5.2, prs_merged_30d: 2, avg_pr_review_hrs: 14.0 },
];

const LOAD_ROWS: LoadRow[] = [
  { engineer: 'alice@company.com',   active_linear_issues: 6,  open_prs: 2, unresolved_sentry_errors: 0, pagerduty_incidents_30d: 1,  load_score: 15 },
  { engineer: 'bob@company.com',     active_linear_issues: 9,  open_prs: 4, unresolved_sentry_errors: 3, pagerduty_incidents_30d: 8,  load_score: 45 },
  { engineer: 'priya@company.com',   active_linear_issues: 5,  open_prs: 3, unresolved_sentry_errors: 1, pagerduty_incidents_30d: 2,  load_score: 19 },
  { engineer: 'james@company.com',   active_linear_issues: 4,  open_prs: 2, unresolved_sentry_errors: 0, pagerduty_incidents_30d: 1,  load_score: 13 },
  { engineer: 'diana@company.com',   active_linear_issues: 7,  open_prs: 1, unresolved_sentry_errors: 2, pagerduty_incidents_30d: 3,  load_score: 24 },
];

const RISK_ROWS: RiskRow[] = [
  { pull_request: 'refactor payment service auth',   author: 'alice@company.com', pr_number: 483, days_open: 9, related_sentry_errors: 4, related_incidents: 1, risk_score: 38 },
  { pull_request: 'update auth middleware',           author: 'diana@company.com', pr_number: 491, days_open: 6, related_sentry_errors: 0, related_incidents: 0, risk_score: 6  },
  { pull_request: 'migrate database connection pool', author: 'bob@company.com',   pr_number: 477, days_open: 4, related_sentry_errors: 1, related_incidents: 0, risk_score: 8  },
];

const DORA_ROWS: DoraMetricRow[] = [
  { metric: 'deployment_frequency',  measurement_type: 'proxy_pr_merges',                       value_per_week: 6.2,  unit: 'deploys/week' },
  { metric: 'lead_time_for_changes', measurement_type: 'linear_created_to_pr_merged',            value_per_week: 52.0, unit: 'hours'        },
  { metric: 'change_failure_rate',   measurement_type: 'pr_to_incident_within_48h',              value_per_week: 8.1,  unit: 'percent'      },
  { metric: 'mttr',                  measurement_type: 'pagerduty_incident_created_to_resolved', value_per_week: 4.2,  unit: 'hours'        },
];

// ─── Derived facts ────────────────────────────────────────────────────────────

const velocity    = formatVelocityFacts(VELOCITY_ROWS);
const workload    = formatWorkloadFacts(LOAD_ROWS);
const bottlenecks = formatBottleneckFacts(VELOCITY_ROWS, LOAD_ROWS);
const risks       = formatRiskFacts(RISK_ROWS);
const dora        = extractDoraSignals(DORA_ROWS);

// ─── Shared metadata ──────────────────────────────────────────────────────────

const META: ReportMetadata = {
  teamName: 'Backend',
  generatedAt: 'May 31, 2026',
  periodDays: 30,
  sourcesQueried: ['GitHub', 'Linear', 'Sentry', 'PagerDuty'],
  sourcesMissing: ['Slack'],
};

// ─── Simulated LLM analysis ───────────────────────────────────────────────────
// In production this is returned by analyzeWithLLM() → Claude API call.

const ROOT_CAUSES = [
  {
    type: 'review_bottleneck' as const,
    title: 'Review bottleneck',
    summary: 'review latency elevated, ownership concentrated on payment-service',
    evidence: [
      { signalKind: 'review', description: 'Alice holds 40% of open PRs', value: 40 },
      { signalKind: 'velocity', description: 'Team review time 19.2 hrs', value: 19.2 },
    ],
    confidence: 'high' as const,
    affectedEngineers: ['alice@company.com'],
  },
  {
    type: 'incident_interference' as const,
    title: 'Incident interference',
    summary: 'paging load for Bob correlates with delivery slowdown this sprint',
    evidence: [
      { signalKind: 'incident', description: 'Bob: 8 PD incidents in 30 days', value: 8 },
    ],
    confidence: 'high' as const,
    affectedEngineers: ['bob@company.com'],
    affectedSystems: ['payment-service', 'backend-api'],
  },
];

const RECOMMENDATIONS = [
  {
    id: 'r1',
    rootCause: 'review_bottleneck' as const,
    action: 'Redistribute payment-service review ownership from Alice to Priya',
    expectedImpact: 'Reduce review latency from 19h to <10h within one sprint.',
    priority: 'high' as const,
    assignee: 'alice@company.com',
  },
  {
    id: 'r2',
    rootCause: 'incident_interference' as const,
    action: 'Move 2 active Linear issues from Bob to James before next sprint planning',
    expectedImpact: 'Free ~25% of Bob\'s delivery capacity.',
    priority: 'high' as const,
    assignee: 'bob@company.com',
  },
];

const SIGNALS = {
  velocity: [], review: [], workload: [], risk: [], incident: [], dora,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function section(n: number, cmd: string, note: string): void {
  const bar = '─'.repeat(55);
  console.log('\n' + bar);
  console.log(`  ${n} / 5   ${cmd}`);
  console.log(`         ${note}`);
  console.log(bar + '\n');
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
  console.log('│   Sources: GitHub · Linear · Sentry · PagerDuty      │');
  console.log('└─────────────────────────────────────────────────────┘\n');
  console.log('  Demo mode — no Coral CLI or API key required.\n');

  await pause(400);

  // ── 1. DRYRUN ──────────────────────────────────────────────────────────────
  section(1, 'sprintlens dryrun', 'no LLM · raw Coral facts as JSON');

  const dryrunOutput = {
    team: META.teamName,
    sources: { connected: ['github', 'linear', 'sentry', 'pagerduty'], missing: ['slack'] },
    facts: {
      velocity: {
        teamAvgCycleDays: Number(velocity.teamAvgCycleDays.toFixed(1)),
        teamAvgReviewHrs: Number(velocity.teamAvgReviewHrs.toFixed(1)),
        engineers: velocity.engineers,
      },
      workload: {
        teamSize: workload.teamSize,
        teamAvgActiveIssues: Number(workload.teamAvgActiveIssues.toFixed(1)),
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
  section(2, 'sprintlens dora', 'deterministic DORA tiers · no LLM required');

  console.log(formatDoraReport(
    META.teamName,
    META.periodDays,
    dora,
    META.sourcesQueried,
    META.sourcesMissing,
  ));

  await pause(600);

  // ── 3. REPORT ──────────────────────────────────────────────────────────────
  section(3, 'sprintlens report', 'full manager sprint briefing · LLM-enriched');

  console.log('  [1/2] Running LLM analysis via Claude...');
  await pause(500);
  console.log('  [2/2] Generating manager report...\n');
  await pause(400);

  const managerReport: ManagerReport = {
    type: 'manager',
    metadata: META,
    signals: SIGNALS,
    rootCauses: ROOT_CAUSES,
    recommendations: RECOMMENDATIONS,
    summary:
      'Average cycle time is 4.2 days. PR review latency increased from 8hrs to ' +
      '19hrs this sprint. One stale PR has correlated Sentry errors and needs ' +
      'triage today.',
    velocitySection:
      'Average cycle time is 4.2 days. Alice is at 7.1 days — 69% above team ' +
      'average. PR review time increased from 8hrs to 19hrs this sprint, ' +
      'suggesting a review bottleneck on the auth service.',
    loadSection:
      'Bob has 9 active issues, 4 open PRs, and 8 PagerDuty pages this month — ' +
      'significantly above team average. Consider redistributing 2-3 issues before ' +
      'next sprint planning.',
    risksSection:
      '• PR #483 "refactor payment service" — open 9 days, 4 correlated Sentry\n' +
      '  errors. Needs triage today before it escalates.\n' +
      '• PR #491 "update auth middleware" — open 6 days, no reviewers assigned.',
  };

  console.log(formatManagerReport(managerReport));

  await pause(600);

  // ── 4. DIGEST ──────────────────────────────────────────────────────────────
  section(4, 'sprintlens digest --engineer alice', 'private engineer digest · LLM · supportive tone');

  console.log('  Generating digest for alice@company.com...\n');
  await pause(400);

  const digest: EmployeeDigest = {
    type: 'employee',
    metadata: META,
    engineerName: 'Alice',
    summary:
      "You're carrying above-average review load this sprint. If helpful, ask " +
      'your manager about redistributing 1-2 reviews before Friday.',
    currentWorkload: [
      { category: 'workload', description: '6 active Linear issues (team avg: 3.2)' },
      { category: 'workload', description: '2 open PRs awaiting review' },
      { category: 'workload', description: '1 unresolved Sentry error assigned to you' },
    ],
    blockers: [
      { category: 'blocker', description: 'PR #491 has been waiting 4 days for review on auth middleware' },
      { category: 'blocker', description: 'Issue ENG-284 blocked on external API dependency' },
    ],
    suggestedActions: [
      { category: 'action', description: 'Pair with Bob on auth middleware review — he has capacity and prior context' },
      { category: 'action', description: 'Escalate ENG-284 dependency in tomorrow\'s standup' },
    ],
    rootCauses: [ROOT_CAUSES[0]],
  };

  console.log(formatEmployeeDigest(digest));

  await pause(600);

  // ── 5. EXECUTIVE ───────────────────────────────────────────────────────────
  section(5, 'sprintlens executive', 'leadership summary · LLM · no engineer names');

  console.log('  Generating executive report...\n');
  await pause(400);

  const executive: ExecutiveReport = {
    type: 'executive',
    metadata: META,
    deliveryConfidence: 'medium',
    summary:
      'Velocity is below target driven by a review bottleneck and concentrated ' +
      'on-call load. Both are resolvable without headcount changes.',
    velocityTrend:
      'Cycle time rose 18% vs last 30 days. Lead time for changes is 52 hours ' +
      '(High tier). Deployment frequency proxy: 6.2 PR merges/week to main.',
    engineeringRisk:
      'Two stale PRs carry correlated production errors. Review bottleneck is ' +
      'slowing auth-service work. On-call load is elevated for 2 engineers.',
    rootCauses: ROOT_CAUSES,
    recommendations: RECOMMENDATIONS,
    doraSummary:
      'Deployment Frequency   6.2/week     High (proxy)\n' +
      'Lead Time              52 hrs       High\n' +
      'Change Failure Rate    8.1%         High\n' +
      'MTTR                   4.2 hrs      Elite',
  };

  console.log(formatExecutiveReport(executive));

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('\n┌─────────────────────────────────────────────────────┐');
  console.log('│                   Demo complete ✓                    │');
  console.log('│                                                      │');
  console.log('│  To run with real data:                              │');
  console.log('│    coral source add --interactive github             │');
  console.log('│    coral source add --interactive linear             │');
  console.log('│    cp sprintlens.toml.example sprintlens.toml        │');
  console.log('│    export ANTHROPIC_API_KEY=sk-ant-...               │');
  console.log('│    sprintlens report                                 │');
  console.log('└─────────────────────────────────────────────────────┘\n');
}

main().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
