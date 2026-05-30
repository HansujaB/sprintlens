import type { LoadRow, WorkloadSignal, IncidentSignal } from '../types/signals.js';
import { ANALYSIS_THRESHOLDS } from '../coral/schema.js';

function countOverloadSignals(row: LoadRow): number {
  let count = 0;
  if (row.active_linear_issues >= ANALYSIS_THRESHOLDS.overloadedActiveIssues) count++;
  if (row.open_prs >= ANALYSIS_THRESHOLDS.overloadedOpenPrs) count++;
  if (row.unresolved_sentry_errors >= 3) count++;
  if (row.pagerduty_incidents_30d >= ANALYSIS_THRESHOLDS.pagerdutyIncidents30d) count++;
  return count;
}

/** Extract workload and incident signals from load query rows. */
export function extractWorkloadSignals(rows: LoadRow[]): {
  workload: WorkloadSignal[];
  incident: IncidentSignal[];
} {
  const workload: WorkloadSignal[] = [];
  const incident: IncidentSignal[] = [];

  for (const row of rows) {
    const overloadSignalCount = countOverloadSignals(row);
    if (overloadSignalCount >= ANALYSIS_THRESHOLDS.overloadSignalCount) {
      workload.push({
        kind: 'workload',
        engineer: row.engineer,
        activeIssues: row.active_linear_issues,
        openPrs: row.open_prs,
        sentryErrors: row.unresolved_sentry_errors,
        pagerdutyIncidents: row.pagerduty_incidents_30d,
        overloadSignalCount,
        severity: overloadSignalCount >= 4 ? 'critical' : 'elevated',
        description: `${row.engineer} has ${row.active_linear_issues} active issues, ${row.open_prs} open PRs, ${row.pagerduty_incidents_30d} pages in 30d`,
      });
    }

    if (row.pagerduty_incidents_30d >= ANALYSIS_THRESHOLDS.pagerdutyIncidents30d) {
      incident.push({
        kind: 'incident',
        engineer: row.engineer,
        incidentCount30d: row.pagerduty_incidents_30d,
        severity: row.pagerduty_incidents_30d >= 10 ? 'critical' : 'elevated',
        description: `${row.engineer} had ${row.pagerduty_incidents_30d} PagerDuty incidents in the last 30 days`,
      });
    }
  }

  return { workload, incident };
}
