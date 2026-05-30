/** Engineer identity mapping across GitHub, Linear, Sentry, PagerDuty, and Slack. */
export interface EngineerIdentity {
  github: string;
  email: string;
  slack: string;
}

/** Resolved engineer with canonical display name from config key. */
export interface ResolvedEngineer extends EngineerIdentity {
  name: string;
}
