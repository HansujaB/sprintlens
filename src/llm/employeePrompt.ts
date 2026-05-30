import type { ReportInput } from '../types/report.js';

/** Build an individual engineer digest prompt from structured findings. */
export function buildEmployeePrompt(input: ReportInput, engineerName: string): string {
  const { metadata, signals, rootCauses } = input;

  const engineerSignals = {
    velocity: signals.velocity.filter((s) => s.engineer?.includes(engineerName)),
    workload: signals.workload.filter((s) => s.engineer.includes(engineerName)),
    risk: signals.risk.filter((s) => s.author.includes(engineerName)),
  };

  return `You are writing a private weekly digest for engineer "${engineerName}" on team "${metadata.teamName}".

Tone: supportive and actionable. Focus on workload, blockers, and suggested next steps.
Do not compare this engineer to teammates or use performance review language.

Period: last ${metadata.periodDays} days

ENGINEER SIGNALS:
${JSON.stringify(engineerSignals, null, 2)}

RELEVANT ROOT CAUSES:
${JSON.stringify(rootCauses, null, 2)}

Output format:
1. Brief greeting
2. WORKLOAD (bullet list)
3. BLOCKERS (bullet list)
4. SUGGESTED ACTIONS (bullet list)

Keep under 15 lines. Write as a direct message, not a formal report.`;
}
