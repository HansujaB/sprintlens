import type { EmployeeDigest, ExecutiveReport, ManagerReport } from '../types/report.js';
import type { DoraSignal } from '../types/signals.js';

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

const DORA_LABELS: Record<DoraSignal['metric'], string> = {
  deployment_frequency: 'Deployment Frequency',
  lead_time_for_changes: 'Lead Time for Changes',
  change_failure_rate: 'Change Failure Rate',
  mttr: 'MTTR',
};

function formatDoraValue(signal: DoraSignal): string {
  if (signal.metric === 'deployment_frequency') {
    return `${signal.value}/week`;
  }
  if (signal.metric === 'change_failure_rate') {
    return `${signal.value}%`;
  }
  if (signal.unit === 'hours') {
    return `${signal.value} hrs`;
  }
  return `${signal.value} ${signal.unit}`;
}

function capitalizeTier(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/** Render DORA metrics for terminal or email output. */
export function formatDoraReport(
  teamName: string,
  periodDays: number,
  signals: DoraSignal[],
  sourcesQueried: string[],
  sourcesMissing: string[],
): string {
  const divider = '━'.repeat(43);
  const lines = [
    divider,
    `  DORA METRICS — ${teamName} · Last ${periodDays} days`,
    divider,
    '',
  ];

  const order: DoraSignal['metric'][] = [
    'deployment_frequency',
    'lead_time_for_changes',
    'change_failure_rate',
    'mttr',
  ];

  for (const metric of order) {
    const signal = signals.find((s) => s.metric === metric);
    const label = DORA_LABELS[metric].padEnd(22, ' ');
    if (!signal) {
      lines.push(`${label} unavailable`);
      continue;
    }
    const proxy =
      signal.measurementType === 'proxy_pr_merges' ? ' (proxy)' : '';
    const pagerdutyNote =
      (metric === 'change_failure_rate' || metric === 'mttr') &&
      sourcesMissing.includes('pagerduty')
        ? ' *'
        : '';
    lines.push(
      `${label}${formatDoraValue(signal).padEnd(14, ' ')}${capitalizeTier(signal.tier)}${proxy}${pagerdutyNote}`,
    );
  }

  if (sourcesMissing.includes('pagerduty')) {
    lines.push('', '* Requires PagerDuty — connect with: coral source add --interactive pagerduty');
  }

  lines.push(
    '',
    divider,
    `Computed from: ${sourcesQueried.join(' · ') || 'none'}`,
  );

  return lines.join('\n');
}

/** Render an executive report as plain text for terminal or email. */
export function formatExecutiveReport(report: ExecutiveReport): string {
  const { metadata } = report;
  const divider = '━'.repeat(43);

  const sections = [
    divider,
    `  ENGINEERING HEALTH — ${metadata.teamName}`,
    `  ${metadata.generatedAt} · Last ${metadata.periodDays} days`,
    divider,
    '',
    `DELIVERY CONFIDENCE: ${report.deliveryConfidence.toUpperCase()}`,
    '',
    report.summary,
    '',
    'VELOCITY TREND',
    report.velocityTrend,
    '',
    'ENGINEERING RISK',
    report.engineeringRisk,
  ];

  if (report.rootCauses.length > 0) {
    sections.push('', 'TOP ROOT CAUSES');
    for (const [i, cause] of report.rootCauses.slice(0, 3).entries()) {
      sections.push(`${i + 1}. ${cause.title} — ${cause.summary}`);
    }
  }

  if (report.recommendations.length > 0) {
    sections.push('', 'RECOMMENDED ACTIONS');
    for (const rec of report.recommendations.slice(0, 3)) {
      sections.push(`• ${rec.action}`);
    }
  }

  if (report.doraSummary) {
    sections.push('', 'DORA SUMMARY', report.doraSummary);
  }

  sections.push(
    '',
    divider,
    `Sources: ${metadata.sourcesQueried.join(' · ') || 'none'}`,
  );

  return sections.join('\n');
}

/** Truncate text to a max line count. */
export function truncateLines(text: string, maxLines: number): string {
  return text.split('\n').slice(0, maxLines).join('\n');
}
