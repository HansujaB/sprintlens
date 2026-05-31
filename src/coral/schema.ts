import type { CoralSource } from '../types/signals.js';

/** Known Coral table names per source — used for doctor checks. */
export const CORAL_TABLES: Record<CoralSource, string[]> = {
  github: ['pull_requests', 'repos'],
  linear: ['issues'],
  sentry: ['issues'],
  pagerduty: ['incidents'],
  slack: ['messages', 'channels'],
};

/** Required filters per table — values come from sprintlens.toml. */
export const TABLE_FILTERS: Record<string, string[]> = {
  'github.pull_requests': ['base_repo_owner', 'base_repo_name'],
  'linear.issues': ['team_name'],
};

/** DORA benchmark tiers in hours unless noted. */
export const DORA_BENCHMARKS = {
  lead_time_hours: { elite: 1, high: 24, medium: 168 },
  change_failure_rate_pct: { elite: 5, high: 10, medium: 15 },
  mttr_hours: { elite: 1, high: 24, medium: 168 },
} as const;
