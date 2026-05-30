import type { ReportInput } from '../types/report.js';

/** Build the manager report prompt from structured findings — no raw Coral data. */
export function buildManagerPrompt(input: ReportInput): string {
  const { metadata, signals, rootCauses, recommendations } = input;

  return `You are writing a weekly engineering manager briefing for team "${metadata.teamName}".

Write in plain prose. Focus on systems and bottlenecks, not individual performance judgments.
Never rank engineers or use language suitable for performance reviews.

Period: last ${metadata.periodDays} days
Sources queried: ${metadata.sourcesQueried.join(', ') || 'none'}
Sources missing: ${metadata.sourcesMissing.join(', ') || 'none'}

SIGNALS (already computed — do not recalculate):
${JSON.stringify(signals, null, 2)}

ROOT CAUSES:
${JSON.stringify(rootCauses, null, 2)}

RECOMMENDATIONS:
${JSON.stringify(recommendations, null, 2)}

Output format:
1. A 2-sentence executive summary
2. VELOCITY section (2-3 sentences with numbers)
3. LOAD section (2-3 sentences)
4. ROOT CAUSES (bullet list)
5. RECOMMENDED ACTIONS (bullet list)
6. RISKS (bullet list from risk signals)

Keep total output under 30 lines. Be specific and actionable.`;
}
