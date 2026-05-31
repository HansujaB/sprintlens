import type { CoralFacts, AnalysisResult } from '../types/signals.js';
import type { ReportMetadata } from '../types/report.js';
import { formatVelocityFacts } from '../analysis/velocity.js';
import { formatWorkloadFacts } from '../analysis/workload.js';
import { formatBottleneckFacts } from '../analysis/bottlenecks.js';
import { formatRiskFacts } from '../analysis/risks.js';
import { extractDoraSignals } from '../analysis/rootCause.js';
import { callClaude } from './client.js';
import { logger } from '../utils/logger.js';

/**
 * Build the structured analysis prompt from raw Coral facts.
 *
 * The analysis layer formats raw facts (with useful computed numbers like
 * deviation %, concentration %, load index) but makes no severity judgments.
 * Claude receives all the data it needs to reason about:
 *   • team size and context
 *   • relative numbers (not just absolutes)
 *   • which sources are available vs missing
 * and returns a structured AnalysisResult JSON object.
 */
function buildAnalysisPrompt(facts: CoralFacts, metadata: ReportMetadata): string {
  const velocity = formatVelocityFacts(facts.velocity);
  const workload = formatWorkloadFacts(facts.load);
  const bottlenecks = formatBottleneckFacts(facts.velocity, facts.load);
  const risks = formatRiskFacts(facts.risks);
  const dora = extractDoraSignals(facts.dora);

  return `You are the analysis engine for SprintLens, an engineering team health tool.

Your job is to examine raw engineering metrics for team "${metadata.teamName}" and produce a
structured analysis: signals (what is notable), root causes (why), and recommendations (what to do).

## Context
- Period: last ${metadata.periodDays} days
- Team size: ${workload.teamSize} engineers
- Sources available: ${metadata.sourcesQueried.join(', ') || 'none'}
- Sources missing: ${metadata.sourcesMissing.join(', ') || 'none'}

## Raw Facts

### Velocity
Team average cycle time: ${velocity.teamAvgCycleDays.toFixed(1)} days
Team average PR review time: ${velocity.teamAvgReviewHrs.toFixed(1)} hours

Per-engineer velocity (cycleDeviationPct is % above/below team average; null = insufficient data):
${JSON.stringify(velocity.engineers, null, 2)}

### Workload & Incidents
Team averages — active issues: ${workload.teamAvgActiveIssues.toFixed(1)}, open PRs: ${workload.teamAvgOpenPrs.toFixed(1)}, incidents/30d: ${workload.teamAvgIncidents30d.toFixed(1)}

Per-engineer load (loadIndexVsTeam: positive = above team average, 0 = at average):
${JSON.stringify(workload.engineers, null, 2)}

### PR Concentration & Review
Total open PRs across team: ${bottlenecks.totalOpenPrs}
${JSON.stringify(bottlenecks.prConcentration, null, 2)}

### Delivery Risks (Stale PRs)
${risks.stalePrCount} stale PRs:
${JSON.stringify(risks.prs, null, 2)}

### DORA Metrics (industry-standard tiers: elite > high > medium > low)
${JSON.stringify(dora, null, 2)}

## Instructions

Analyse the facts above with engineering judgment. Consider:
- Is a high cycle deviation meaningful given team size and sprint context, or is it noise?
- PR concentration is expected on small teams — flag it only if it is causing actual delays.
- Correlate signals across dimensions (e.g. a high-load engineer who also has stale PRs and incidents).
- Identify the most likely root causes, not every possible one.
- Recommendations must be specific and actionable for this team, not generic templates.

Respond ONLY with a JSON object matching this exact TypeScript shape (no markdown, no explanation):

{
  "signals": {
    "velocity": [
      {
        "kind": "velocity",
        "metric": "cycle_time" | "pr_review_time" | "issues_completed" | "prs_merged",
        "engineer": string | undefined,
        "value": number,
        "teamAverage": number | undefined,
        "deviationPct": number | undefined,
        "severity": "normal" | "elevated" | "critical",
        "description": string
      }
    ],
    "review": [
      {
        "kind": "review",
        "metric": "review_latency" | "review_concentration" | "open_prs",
        "value": number,
        "threshold": number | undefined,
        "severity": "normal" | "elevated" | "critical",
        "description": string,
        "engineer": string | undefined,
        "concentrationPct": number | undefined
      }
    ],
    "workload": [
      {
        "kind": "workload",
        "engineer": string,
        "activeIssues": number,
        "openPrs": number,
        "sentryErrors": number,
        "pagerdutyIncidents": number,
        "overloadSignalCount": number,
        "severity": "normal" | "elevated" | "critical",
        "description": string
      }
    ],
    "risk": [
      {
        "kind": "risk",
        "pullRequest": string,
        "prNumber": number,
        "author": string,
        "daysOpen": number,
        "relatedSentryErrors": number,
        "relatedIncidents": number,
        "severity": "normal" | "elevated" | "critical",
        "description": string
      }
    ],
    "incident": [
      {
        "kind": "incident",
        "engineer": string | undefined,
        "incidentCount30d": number,
        "severity": "normal" | "elevated" | "critical",
        "description": string
      }
    ],
    "dora": [the DORA signals already computed — pass through as-is]
  },
  "rootCauses": [
    {
      "type": "review_bottleneck" | "ownership_bottleneck" | "incident_interference" | "context_switching" | "sprint_scope_creep" | "knowledge_concentration",
      "title": string,
      "summary": string,
      "evidence": [{ "signalKind": string, "description": string, "value": number | string | undefined }],
      "confidence": "low" | "medium" | "high",
      "affectedEngineers": string[] | undefined,
      "affectedSystems": string[] | undefined
    }
  ],
  "recommendations": [
    {
      "id": string,
      "rootCause": string (one of the rootCause types above),
      "action": string (specific, actionable, tailored to this team's situation),
      "expectedImpact": string,
      "priority": "high" | "medium" | "low",
      "assignee": string | undefined
    }
  ]
}

The "dora" array in signals should be exactly: ${JSON.stringify(dora)}

Only include signals, root causes, and recommendations that are genuinely notable.
An empty array is valid if nothing stands out.`;
}

/**
 * Run LLM-powered analysis: passes raw Coral facts to Claude, which returns
 * a structured AnalysisResult (signals, rootCauses, recommendations).
 *
 * This replaces the old deterministic analyzeRootCauses() + generateRecommendations()
 * pipeline with context-aware reasoning that understands team size, relative load,
 * sprint context, and cross-signal correlations.
 */
export async function analyzeWithLLM(
  facts: CoralFacts,
  metadata: ReportMetadata,
  apiKey: string,
): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(facts, metadata);

  logger.info('Running LLM analysis (signals, root causes, recommendations)...');

  const raw = await callClaude(
    [{ role: 'user', content: prompt }],
    apiKey,
    4096,
  );

  let parsed: AnalysisResult;
  try {
    // Strip any accidental markdown fences the model may have added
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    parsed = JSON.parse(cleaned) as AnalysisResult;
  } catch (err) {
    logger.warn('LLM returned malformed JSON — falling back to empty analysis.');
    logger.warn(`Parse error: ${String(err)}`);
    logger.warn(`Raw response (first 500 chars): ${raw.slice(0, 500)}`);

    // Graceful fallback: return DORA signals only, empty everything else
    const dora = extractDoraSignals(facts.dora);
    parsed = {
      signals: { velocity: [], review: [], workload: [], risk: [], incident: [], dora },
      rootCauses: [],
      recommendations: [],
    };
  }

  // Always ensure DORA signals are present (they are deterministic and cheap to compute)
  if (!parsed.signals.dora || parsed.signals.dora.length === 0) {
    parsed.signals.dora = extractDoraSignals(facts.dora);
  }

  return parsed;
}
