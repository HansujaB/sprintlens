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
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUERIES_DIR = join(__dirname, 'queries');

// ─── CRITICAL FIX 4: configurable query timeout ──────────────────────────────
const QUERY_TIMEOUT_MS = Number(process.env.SPRINTLENS_QUERY_TIMEOUT_MS ?? 30_000);

export class CoralError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoralError';
  }
}

function loadQuery(filename: string): string {
  return readFileSync(join(QUERIES_DIR, filename), 'utf-8');
}

// ─── CRITICAL FIX 1: input validation before substitution ────────────────────
/**
 * Allowlist patterns per substitution key.
 * These are strict — intentionally reject anything that could be a SQL metacharacter
 * or shell injection vector embedded in a config value.
 */
const SUBSTITUTION_RULES: Record<string, RegExp> = {
  // GitHub org/repo: alphanumeric, hyphens, dots, underscores (GitHub naming rules)
  github_org:  /^[A-Za-z0-9]([A-Za-z0-9._-]{0,99})?$/,
  github_repo: /^[A-Za-z0-9]([A-Za-z0-9._-]{0,99})?$/,
  // Linear team name: printable text, no SQL metacharacters
  linear_team: /^[A-Za-z0-9 _\-.]{1,100}$/,
  // engineer_emails is validated separately in buildEmailList — skip here
  engineer_emails: null as unknown as RegExp,
};

function validateSubstitutionValue(key: string, value: string): void {
  // engineer_emails is a pre-built SQL fragment validated per-email — not checked here
  if (key === 'engineer_emails') return;

  const pattern = SUBSTITUTION_RULES[key];
  if (!pattern) {
    // Unknown key — apply a conservative default: no SQL metacharacters
    if (/['";\\`\n\r]/.test(value)) {
      throw new CoralError(
        `Query variable {${key}} contains unsafe characters. ` +
        `Value must not contain quotes, semicolons, or backslashes.`,
      );
    }
    return;
  }

  if (!pattern.test(value)) {
    throw new CoralError(
      `Query variable {${key}} has an invalid value: "${value}". ` +
      `Check the [team] section in sprintlens.toml — only alphanumeric characters, ` +
      `hyphens, dots, and underscores are allowed.`,
    );
  }
}

function substitute(sql: string, vars: Record<string, string>): string {
  let result = sql;
  for (const [key, value] of Object.entries(vars)) {
    validateSubstitutionValue(key, value);       // ← throws before any substitution
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

/** Validated email pattern — no SQL or shell metacharacters allowed. */
const SAFE_EMAIL_RE = /^[^\s'";<>\\@]+@[^\s'";<>\\@]+\.[^\s'";<>\\@]+$/;

function buildEmailList(emails: string[]): string {
  // ─── CRITICAL FIX 1 (cont.) + MEDIUM FIX 15: guard empty list ────────────
  if (emails.length === 0) {
    throw new CoralError(
      'No engineers are configured in sprintlens.toml [engineers]. ' +
      'At least one engineer is required to run queries.',
    );
  }

  return emails
    .map((e) => {
      if (!SAFE_EMAIL_RE.test(e)) {
        throw new CoralError(
          `Engineer email "${e}" contains unsafe characters. ` +
          `Emails must not contain quotes, spaces, semicolons, or backslashes.`,
        );
      }
      // Additional single-quote escaping as a belt-and-suspenders measure
      return `'${e.replace(/'/g, "''")}'`;
    })
    .join(',\n    ');
}

// ─── CRITICAL FIX 4: timeout-aware SQL execution ─────────────────────────────
/** Execute a SQL string via the Coral CLI and return parsed JSON rows. */
export async function executeSql(sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('coral', ['sql', sql], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    /** Settle only once — whichever fires first (timeout, error, or close). */
    function settle(fn: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    }

    // Timeout: kill the child and reject
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      settle(() =>
        reject(
          new CoralError(
            `coral sql timed out after ${QUERY_TIMEOUT_MS}ms. ` +
            `Set SPRINTLENS_QUERY_TIMEOUT_MS to increase the limit.`,
          ),
        ),
      );
    }, QUERY_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      settle(() => {
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
          reject(
            new CoralError(`Failed to parse Coral output as JSON: ${trimmed.slice(0, 200)}`),
          );
        }
      });
    });

    child.on('error', (err) => {
      settle(() =>
        reject(new CoralError(`Failed to spawn coral CLI: ${err.message}`)),
      );
    });
  });
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

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
    load_score: Number(row.load_score ?? 0),
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
    risk_score: Number(row.risk_score ?? 0),
  };
}

const VALID_DORA_METRICS = new Set([
  'deployment_frequency',
  'lead_time_for_changes',
  'change_failure_rate',
  'mttr',
]);

function rowToDora(row: Record<string, unknown>): DoraMetricRow | null {
  const metric = String(row.metric ?? '');
  if (!VALID_DORA_METRICS.has(metric)) {
    logger.warn(`Unexpected DORA metric name "${metric}" from Coral — skipping row.`);
    return null;
  }
  return {
    metric: metric as DoraMetricRow['metric'],
    measurement_type: String(row.measurement_type ?? ''),
    value_per_week: Number(row.value_per_week ?? 0),
    unit: String(row.unit ?? ''),
  };
}

// ─── Source discovery ─────────────────────────────────────────────────────────

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

// ─── Query helpers ────────────────────────────────────────────────────────────

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

// ─── CRITICAL FIX 3: dynamic DORA query — PagerDuty blocks only when connected ─
/**
 * Build and run the DORA metrics query.
 *
 * The query is assembled from individual SQL fragments. PagerDuty-dependent
 * metrics (change_failure_rate, mttr) are only included when PagerDuty is
 * a connected Coral source — preventing a query failure when it is absent.
 */
export async function runDoraQuery(
  config: SprintLensConfig,
  connectedSources: CoralSource[],
): Promise<DoraMetricRow[]> {
  const vars = queryVars(config);
  const hasPagerDuty = connectedSources.includes('pagerduty');

  const parts: string[] = [
    substitute(loadQuery('dora-deployment-frequency.sql'), vars),
    substitute(loadQuery('dora-lead-time.sql'), vars),
  ];

  if (hasPagerDuty) {
    parts.push(substitute(loadQuery('dora-cfr.sql'), vars));
    parts.push(substitute(loadQuery('dora-mttr.sql'), vars));
  } else {
    logger.debug('PagerDuty not connected — skipping change_failure_rate and mttr DORA metrics.');
  }

  const sql = parts.join('\n\nUNION ALL\n\n');
  const rows = await executeSql(sql);
  return rows.map(rowToDora).filter((r): r is DoraMetricRow => r !== null);
}

// ─── CRITICAL FIX 2: Promise.allSettled — one failing query can't crash the run ─
/**
 * Run all Coral queries and return aggregated facts.
 *
 * Uses Promise.allSettled so a single flaky source (Sentry timeout, PagerDuty
 * rate-limit) does not crash the entire pipeline. Failed queries log a warning
 * and return an empty array — the rest of the pipeline continues normally.
 */
export async function runAllQueries(
  config: SprintLensConfig,
  sourceStatus: CoralSourceStatus,
): Promise<CoralFacts> {
  const [velocityResult, loadResult, risksResult, doraResult] = await Promise.allSettled([
    runVelocityQuery(config),
    runLoadQuery(config),
    runRiskQuery(config),
    runDoraQuery(config, sourceStatus.connected),
  ]);

  function settle<T>(result: PromiseSettledResult<T[]>, name: string): T[] {
    if (result.status === 'fulfilled') return result.value;
    const reason =
      result.reason instanceof Error ? result.reason.message : String(result.reason);
    logger.warn(`${name} query failed — continuing without it: ${reason}`);
    return [];
  }

  return {
    velocity: settle(velocityResult, 'velocity'),
    load: settle(loadResult, 'load'),
    risks: settle(risksResult, 'risks'),
    dora: settle(doraResult, 'dora'),
  };
}
