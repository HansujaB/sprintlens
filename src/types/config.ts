import type { EngineerIdentity } from './engineer.js';

/** Team-level settings from sprintlens.toml [team]. */
export interface TeamConfig {
  name: string;
  github_org: string;
  github_repo: string;
  linear_team: string;
  sentry_org: string;
  pagerduty_service: string;
  slack_channel: string;
}

/** SMTP settings for email delivery — credentials via env vars. */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  from: string;
}

/** Optional delivery targets and transport config. */
export interface DeliverySettings {
  manager_email?: string;
  smtp?: SmtpConfig;
}

/** Full SprintLens configuration loaded from sprintlens.toml. */
export interface SprintLensConfig {
  team: TeamConfig;
  engineers: Record<string, EngineerIdentity>;
  delivery?: DeliverySettings;
}
