import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SprintLensConfig } from '../types/config.js';
import type {
  CoralFacts,
  CoralSource,
  CoralSourceStatus,
  DoraMetricRow,
  LoadRow,
  RiskRow,
  VelocityRow,
} from '../types/signals.js';
import { getEngineerEmails } from '../config/loadConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUERIES_DIR = join(__dirname, 'queries');

export class CoralError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoralError';
  }
}

function loadQuery(filename: string): string {
  return readFileSync(join(QUERIES_DIR, filename), 'utf-8');
}

function substitute(sql: string, vars: Record<string, string>): string {
  let result = sql;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

function buildEmailList(emails: string[]): string {
  return emails.map((e) => `'${e.replace(/'/g, "''")}'`).join(',\n    ');
}

/** Execute a SQL string via the Coral CLI and return parsed JSON rows. */
export async function executeSql(sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('coral', ['sql', sql], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new CoralError(stderr.trim() || `coral sql exited with code ${code}`));
        return;
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve([]);
        return;
      }

      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          resolve(parsed as Record<string, unknown>[]);
        } else {
          resolve([parsed as Record<string, unknown>]);
        }
      } catch {
        reject(new CoralError(`Failed to parse Coral output as JSON: ${trimmed.slice(0, 200)}`));
      }
    });

    child.on('error', (err) => {
      reject(new CoralError(`Failed to spawn coral CLI: ${err.message}`));
    });
  });
}

function rowToVelocity(row: Record<string, unknown>): VelocityRow {
  return {
    engineer: String(row.engineer ?? ''),
    issues_completed_30d: Number(row.issues_completed_30d ?? 0),
    avg_cycle_days: Number(row.avg_cycle_days ?? 0),
    prs_merged_30d: Number(row.prs_merged_30d ?? 0),
    avg_pr_review_hrs: Number(row.avg_pr_review_hrs ?? 0),
  };
}

function rowToLoad(row: Record<string, unknown>): LoadRow {
  return {
    engineer: String(row.engineer ?? ''),
    active_linear_issues: Number(row.active_linear_issues ?? 0),
    open_prs: Number(row.open_prs ?? 0),
    unresolved_sentry_errors: Number(row.unresolved_sentry_errors ?? 0),
    pagerduty_incidents_30d: Number(row.pagerduty_incidents_30d ?? 0),
  };
}

function rowToRisk(row: Record<string, unknown>): RiskRow {
  return {
    pull_request: String(row.pull_request ?? ''),
    author: String(row.author ?? ''),
    pr_number: Number(row.pr_number ?? 0),
    days_open: Number(row.days_open ?? 0),
    related_sentry_errors: Number(row.related_sentry_errors ?? 0),
    related_incidents: Number(row.related_incidents ?? 0),
  };
}

function rowToDora(row: Record<string, unknown>): DoraMetricRow {
  return {
    metric: row.metric as DoraMetricRow['metric'],
    measurement_type: String(row.measurement_type ?? ''),
    value_per_week: Number(row.value_per_week ?? 0),
    unit: String(row.unit ?? ''),
  };
}

const ALL_SOURCES: CoralSource[] = ['github', 'linear', 'sentry', 'pagerduty', 'slack'];

/** Discover which Coral sources are connected. */
export async function discoverSources(): Promise<CoralSourceStatus> {
  try {
    const rows = await executeSql(
      "SELECT DISTINCT schema_name FROM coral.tables ORDER BY schema_name",
    );
    const connected = rows
      .map((r) => String(r.schema_name ?? ''))
      .filter((s): s is CoralSource => ALL_SOURCES.includes(s as CoralSource));

    const missing = ALL_SOURCES.filter((s) => !connected.includes(s));
    return { connected, missing };
  } catch {
    return { connected: [], missing: [...ALL_SOURCES] };
  }
}

function queryVars(config: SprintLensConfig): Record<string, string> {
  const emails = getEngineerEmails(config);
  return {
    linear_team: config.team.linear_team,
    github_org: config.team.github_org,
    github_repo: config.team.github_repo,
    engineer_emails: buildEmailList(emails),
  };
}

export async function runVelocityQuery(config: SprintLensConfig): Promise<VelocityRow[]> {
  const sql = substitute(loadQuery('velocity.sql'), queryVars(config));
  const rows = await executeSql(sql);
  return rows.map(rowToVelocity);
}

export async function runLoadQuery(config: SprintLensConfig): Promise<LoadRow[]> {
  const sql = substitute(loadQuery('load.sql'), queryVars(config));
  const rows = await executeSql(sql);
  return rows.map(rowToLoad);
}

export async function runRiskQuery(config: SprintLensConfig): Promise<RiskRow[]> {
  const sql = substitute(loadQuery('risks.sql'), queryVars(config));
  const rows = await executeSql(sql);
  return rows.map(rowToRisk);
}

export async function runDoraQuery(config: SprintLensConfig): Promise<DoraMetricRow[]> {
  const sql = substitute(loadQuery('dora.sql'), queryVars(config));
  const rows = await executeSql(sql);
  return rows.map(rowToDora);
}

/** Run all Coral queries and return aggregated facts. */
export async function runAllQueries(config: SprintLensConfig): Promise<CoralFacts> {
  const [velocity, load, risks, dora] = await Promise.all([
    runVelocityQuery(config),
    runLoadQuery(config),
    runRiskQuery(config),
    runDoraQuery(config),
  ]);
  return { velocity, load, risks, dora };
}
