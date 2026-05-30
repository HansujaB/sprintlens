import type { AnalysisResult } from '../types/signals.js';
import type { ManagerReport, ReportInput, ReportMetadata } from '../types/report.js';
import { buildManagerPrompt } from '../llm/managerPrompt.js';
import { callClaude } from '../llm/client.js';

export async function generateManagerReport(
  metadata: ReportMetadata,
  analysis: AnalysisResult,
  apiKey: string,
): Promise<ManagerReport> {
  const input: ReportInput = {
    metadata,
    signals: analysis.signals,
    rootCauses: analysis.rootCauses,
    recommendations: analysis.recommendations,
  };

  const prose = await callClaude(
    [{ role: 'user', content: buildManagerPrompt(input) }],
    apiKey,
  );

  const velocityLines = analysis.signals.velocity
    .slice(0, 3)
    .map((s) => s.description)
    .join('. ');

  const loadLines = analysis.signals.workload
    .slice(0, 3)
    .map((s) => s.description)
    .join('. ');

  const riskLines = analysis.signals.risk
    .slice(0, 5)
    .map((s) => `• ${s.description}`)
    .join('\n');

  return {
    type: 'manager',
    metadata,
    summary: prose.split('\n')[0] ?? '',
    signals: analysis.signals,
    rootCauses: analysis.rootCauses,
    recommendations: analysis.recommendations,
    velocitySection: velocityLines || 'No velocity signals detected.',
    loadSection: loadLines || 'No load signals detected.',
    risksSection: riskLines || 'No risk signals detected.',
  };
}
