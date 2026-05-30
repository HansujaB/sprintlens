import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import TOML from '@iarna/toml';
import type { SprintLensConfig, SmtpConfig } from '../types/config.js';
import type { EngineerIdentity } from '../types/engineer.js';
import { validateConfig } from './validateConfig.js';

const CONFIG_FILENAME = 'sprintlens.toml';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function parseEngineers(raw: unknown): Record<string, EngineerIdentity> {
  if (!raw || typeof raw !== 'object') {
    throw new ConfigError('[engineers] section is required in sprintlens.toml');
  }

  const engineers: Record<string, EngineerIdentity> = {};

  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') {
      throw new ConfigError(`[engineers.${name}] must be a table with github, email, and slack`);
    }

    const entry = value as Record<string, unknown>;
    engineers[name] = {
      github: String(entry.github ?? ''),
      email: String(entry.email ?? ''),
      slack: String(entry.slack ?? ''),
    };
  }

  return engineers;
}

function parseSmtp(raw: unknown): SmtpConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const smtp = raw as Record<string, unknown>;
  const host = String(smtp.host ?? '').trim();
  if (!host) return undefined;

  return {
    host,
    port: Number(smtp.port ?? 587),
    secure: smtp.secure === true,
    from: String(smtp.from ?? 'SprintLens <noreply@localhost>'),
  };
}

function parseDelivery(raw: unknown): SprintLensConfig['delivery'] {
  if (!raw || typeof raw !== 'object') return undefined;

  const delivery = raw as Record<string, unknown>;
  const smtp = parseSmtp(delivery.smtp);

  const managerEmail = String(delivery.manager_email ?? '').trim();
  const executiveEmail = String(delivery.executive_email ?? '').trim();

  if (!managerEmail && !executiveEmail && !smtp) return undefined;

  return {
    manager_email: managerEmail || undefined,
    executive_email: executiveEmail || undefined,
    smtp,
  };
}

function parseTeam(raw: unknown): SprintLensConfig['team'] {
  if (!raw || typeof raw !== 'object') {
    throw new ConfigError('[team] section is required in sprintlens.toml');
  }

  const team = raw as Record<string, unknown>;

  return {
    name: String(team.name ?? ''),
    github_org: String(team.github_org ?? ''),
    github_repo: String(team.github_repo ?? ''),
    linear_team: String(team.linear_team ?? ''),
    sentry_org: String(team.sentry_org ?? ''),
    pagerduty_service: String(team.pagerduty_service ?? ''),
    slack_channel: String(team.slack_channel ?? ''),
  };
}

/** Load and validate sprintlens.toml from the given directory. */
export function loadConfig(cwd: string = process.cwd()): SprintLensConfig {
  const configPath = resolve(cwd, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    throw new ConfigError(
      `SprintLens needs a ${CONFIG_FILENAME} file in ${cwd}.\n` +
        `Copy sprintlens.toml.example to ${CONFIG_FILENAME} and fill in your team details.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = TOML.parse(readFileSync(configPath, 'utf-8'));
  } catch (err) {
    throw new ConfigError(
      `Failed to parse ${CONFIG_FILENAME}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ConfigError(`${CONFIG_FILENAME} must be a TOML document with [team] and [engineers] sections`);
  }

  const doc = parsed as Record<string, unknown>;
  const config: SprintLensConfig = {
    team: parseTeam(doc.team),
    engineers: parseEngineers(doc.engineers),
    delivery: parseDelivery(doc.delivery),
  };

  validateConfig(config);
  return config;
}

/** Return engineer emails for Coral query IN clauses. */
export function getEngineerEmails(config: SprintLensConfig): string[] {
  return Object.values(config.engineers).map((e) => e.email);
}

/** Resolve SMTP credentials from config and environment. */
export function getSmtpCredentials(): { user?: string; pass?: string } {
  return {
    user: process.env.SPRINTLENS_SMTP_USER,
    pass: process.env.SPRINTLENS_SMTP_PASS,
  };
}

/** List configured engineers as [name, identity] pairs. */
export function listEngineers(
  config: SprintLensConfig,
): Array<[string, EngineerIdentity]> {
  return Object.entries(config.engineers);
}
