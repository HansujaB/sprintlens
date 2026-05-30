import type { SprintLensConfig } from '../types/config.js';

const REQUIRED_TEAM_FIELDS: (keyof SprintLensConfig['team'])[] = [
  'name',
  'github_org',
  'github_repo',
  'linear_team',
];

/** Validate loaded config — throws on missing required fields. */
export function validateConfig(config: SprintLensConfig): void {
  const missingTeam = REQUIRED_TEAM_FIELDS.filter((field) => !config.team[field]?.trim());
  if (missingTeam.length > 0) {
    throw new Error(
      `sprintlens.toml [team] is missing required fields: ${missingTeam.join(', ')}`,
    );
  }

  const engineerEntries = Object.entries(config.engineers);
  if (engineerEntries.length === 0) {
    throw new Error('sprintlens.toml [engineers] must contain at least one engineer');
  }

  for (const [name, engineer] of engineerEntries) {
    if (!engineer.github?.trim()) {
      throw new Error(`sprintlens.toml [engineers.${name}] missing required field: github`);
    }
    if (!engineer.email?.trim()) {
      throw new Error(`sprintlens.toml [engineers.${name}] missing required field: email`);
    }
    if (!engineer.slack?.trim()) {
      throw new Error(`sprintlens.toml [engineers.${name}] missing required field: slack`);
    }
  }
}
