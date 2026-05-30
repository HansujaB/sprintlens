import type { EmployeeDigest, ManagerReport } from '../types/report.js';

/** Render a manager report as terminal-friendly markdown. */
export function formatManagerReport(report: ManagerReport): string {
  const { metadata } = report;
  const divider = '━'.repeat(43);

  return [
    divider,
    `  SPRINT HEALTH — ${metadata.teamName}`,
    `  ${metadata.generatedAt} · Last ${metadata.periodDays} days`,
    divider,
    '',
    'SUMMARY',
    report.summary,
    '',
    'VELOCITY',
    report.velocitySection,
    '',
    'LOAD',
    report.loadSection,
    '',
    'RISKS',
    report.risksSection,
    '',
    divider,
    `Sources: ${metadata.sourcesQueried.join(' · ') || 'none'}`,
    metadata.sourcesMissing.length > 0
      ? `Missing: ${metadata.sourcesMissing.join(' · ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Render an employee digest as plain text for email or terminal. */
export function formatEmployeeDigest(digest: EmployeeDigest): string {
  const sections: string[] = [
    `Hi ${digest.engineerName} — your SprintLens digest for ${digest.metadata.teamName}:`,
    '',
    digest.summary,
  ];

  if (digest.currentWorkload.length > 0) {
    sections.push('', 'WORKLOAD', ...digest.currentWorkload.map((i) => `• ${i.description}`));
  }

  if (digest.blockers.length > 0) {
    sections.push('', 'BLOCKERS', ...digest.blockers.map((i) => `• ${i.description}`));
  }

  if (digest.suggestedActions.length > 0) {
    sections.push('', 'SUGGESTED ACTIONS', ...digest.suggestedActions.map((i) => `• ${i.description}`));
  }

  return sections.join('\n');
}

/** Truncate text to a max line count. */
export function truncateLines(text: string, maxLines: number): string {
  return text.split('\n').slice(0, maxLines).join('\n');
}
