import { loadConfig } from '../config/loadConfig.js';
import { discoverSources, runAllQueries } from '../coral/client.js';
import { extractDoraSignals } from '../analysis/rootCause.js';
import { formatVelocityFacts } from '../analysis/velocity.js';
import { formatWorkloadFacts } from '../analysis/workload.js';
import { formatBottleneckFacts } from '../analysis/bottlenecks.js';
import { formatRiskFacts } from '../analysis/risks.js';
import { logger } from '../utils/logger.js';

/**
 * Dry run — fetch Coral data and output raw facts only (no LLM, no analysis).
 *
 * The output includes pre-computed relative numbers (deviation %, load index,
 * concentration %, DORA tiers) that make the facts human-readable without any
 * LLM involvement. Root causes and recommendations require `sprintlens report`.
 */
export async function runDryrun(cwd: string = process.cwd()): Promise<void> {
  const config = loadConfig(cwd);
  const sourceStatus = await discoverSources();

  logger.info('Dry run — fetching Coral data (no LLM analysis)...');

  const facts = await runAllQueries(config);

  const velocity = formatVelocityFacts(facts.velocity);
  const workload = formatWorkloadFacts(facts.load);
  const bottlenecks = formatBottleneckFacts(facts.velocity, facts.load);
  const risks = formatRiskFacts(facts.risks);
  const dora = extractDoraSignals(facts.dora);

  console.log(
    JSON.stringify(
      {
        team: config.team.name,
        sources: sourceStatus,
        facts: {
          velocity,
          workload,
          bottlenecks,
          risks,
          dora,
        },
      },
      null,
      2,
    ),
  );

  logger.info(
    'Dry run complete. Run `sprintlens report` with ANTHROPIC_API_KEY for full LLM analysis.',
  );
}
