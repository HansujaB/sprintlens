import type { AnalysisResult } from '../types/signals.js';
import type { ExecutiveReport, ReportInput, ReportMetadata } from '../types/report.js';
import { callClaude } from '../llm/client.js';

function buildExecutivePrompt(input: ReportInput): string {
  return `You are writing an executive engineering health summary for team "${input.metadata.teamName}".

Focus on: velocity trend, delivery confidence (high/medium/low), engineering risk.
Do not include private engineer details — speak about systems and team-level patterns.

ROOT CAUSES:
${JSON.stringify(input.rootCauses, null, 2)}

RECOMMENDATIONS:
${JSON.stringify(input.recommendations, null, 2)}

DORA SIGNALS:
${JSON.stringify(input.signals.dora, null, 2)}

Output:
1. 2-sentence summary
2. Velocity trend (1-2 sentences)
3. Engineering risk (1-2 sentences)
4. Top 2 recommended actions

Under 20 lines. Plain prose.`;
}

function inferDeliveryConfidence(analysis: AnalysisResult): ExecutiveReport['deliveryConfidence'] {
  const criticalCount = [
    ...analysis.signals.velocity,
    ...analysis.signals.risk,
    ...analysis.signals.workload,
  ].filter((s) => s.severity === 'critical').length;

  if (criticalCount >= 3) return 'low';
  if (criticalCount >= 1) return 'medium';
  return 'high';
}

export async function generateExecutiveReport(
  metadata: ReportMetadata,
  analysis: AnalysisResult,
  apiKey: string,
): Promise<ExecutiveReport> {
  const input: ReportInput = {
    metadata,
    signals: analysis.signals,
    rootCauses: analysis.rootCauses,
    recommendations: analysis.recommendations,
  };

  const prose = await callClaude(
    [{ role: 'user', content: buildExecutivePrompt(input) }],
    apiKey,
  );

  const doraSummary = analysis.signals.dora
    .map((s) => `${s.metric}: ${s.value} ${s.unit} (${s.tier})`)
    .join('\n');

  return {
    type: 'executive',
    metadata,
    summary: prose,
    velocityTrend: analysis.signals.velocity[0]?.description ?? 'No velocity trend data.',
    deliveryConfidence: inferDeliveryConfidence(analysis),
    engineeringRisk: analysis.signals.risk[0]?.description ?? 'No elevated delivery risks.',
    rootCauses: analysis.rootCauses,
    recommendations: analysis.recommendations,
    doraSummary: doraSummary || undefined,
  };
}
