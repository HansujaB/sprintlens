import type { AnalysisResult } from '../types/signals.js';
import type { EmployeeDigest, ReportInput, ReportMetadata } from '../types/report.js';
import { buildEmployeePrompt } from '../llm/employeePrompt.js';
import { callClaude } from '../llm/client.js';

export async function generateEmployeeDigest(
  metadata: ReportMetadata,
  analysis: AnalysisResult,
  engineerName: string,
  apiKey: string,
): Promise<EmployeeDigest> {
  const input: ReportInput = {
    metadata,
    signals: analysis.signals,
    rootCauses: analysis.rootCauses,
    recommendations: analysis.recommendations,
  };

  const prose = await callClaude(
    [{ role: 'user', content: buildEmployeePrompt(input, engineerName) }],
    apiKey,
    1024,
  );

  const workload = analysis.signals.workload
    .filter((s) => s.engineer.includes(engineerName))
    .map((s) => ({ category: 'workload' as const, description: s.description }));

  const blockers = analysis.signals.risk
    .filter((s) => s.author.includes(engineerName))
    .map((s) => ({ category: 'blocker' as const, description: s.description }));

  const suggestedActions = analysis.recommendations
    .filter((r) => r.assignee?.includes(engineerName))
    .map((r) => ({ category: 'action' as const, description: r.action }));

  return {
    type: 'employee',
    metadata,
    engineerName,
    summary: prose,
    currentWorkload: workload,
    blockers,
    suggestedActions,
    rootCauses: analysis.rootCauses.filter((c) =>
      c.affectedEngineers?.some((e) => e.includes(engineerName)),
    ),
  };
}
