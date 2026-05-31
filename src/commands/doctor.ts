import { loadConfig } from '../config/loadConfig.js';
import { discoverSources, executeSql } from '../coral/client.js';
import { CORAL_TABLES } from '../coral/schema.js';
import { logger } from '../utils/logger.js';

/** Verify config, Coral CLI, and connected sources. */
export async function runDoctor(cwd: string = process.cwd()): Promise<void> {
  let ok = true;

  try {
    const config = loadConfig(cwd);
    logger.info(`Config OK — team "${config.team.name}" with ${Object.keys(config.engineers).length} engineers`);
  } catch (err) {
    ok = false;
    logger.error(err instanceof Error ? err.message : String(err));
  }

  try {
    await executeSql('SELECT 1 AS ok');
    logger.info('Coral CLI OK');
  } catch (err) {
    ok = false;
    logger.error(`Coral CLI failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Check for Anthropic API key (warn only — not required for dryrun/dora)
  if (process.env.ANTHROPIC_API_KEY) {
    logger.info('ANTHROPIC_API_KEY — set (required for report, digest, executive)');
  } else {
    logger.warn('ANTHROPIC_API_KEY — not set (needed for report, digest, executive)');
    logger.warn('  Set with: export ANTHROPIC_API_KEY=sk-ant-…');
    logger.warn('  Not needed for: sprintlens dryrun, sprintlens dora');
  }

  const status = await discoverSources();
  if (status.connected.length === 0) {
    ok = false;
    logger.error('No Coral sources connected');
  } else {
    logger.info(`Connected sources: ${status.connected.join(', ')}`);
  }

  if (status.missing.length > 0) {
    logger.warn(`Missing sources: ${status.missing.join(', ')}`);
    for (const source of status.missing) {
      logger.warn(`  Add with: coral source add --interactive ${source}`);
    }
  }

  for (const source of status.connected) {
    const tables = CORAL_TABLES[source] ?? [];
    for (const table of tables) {
      try {
        await executeSql(
          `SELECT table_name FROM coral.tables WHERE schema_name = '${source}' AND table_name = '${table}' LIMIT 1`,
        );
        logger.info(`  ${source}.${table} — available`);
      } catch {
        logger.warn(`  ${source}.${table} — not found`);
      }
    }
  }

  if (!ok) {
    process.exitCode = 1;
  } else {
    logger.info('Doctor check passed');
  }
}
