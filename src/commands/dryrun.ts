import { loadConfig } from '../config/loadConfig.js';
import { discoverSources, runAllQueries } from '../coral/client.js';
import { extractVelocitySignals } from '../analysis/velocity.js';
import { extractWorkloadSignals } from '../analysis/workload.js';
import { extractRiskSignals } from '../analysis/risks.js';
import { extractBottleneckSignals } from '../analysis/bottlenecks.js';
import { extractDoraSignals, analyzeRootCauses } from '../analysis/rootCause.js';
import { generateRecommendations } from '../analysis/recommendations.js';
import { logger } from '../utils/logger.js';

/** Run pipeline without LLM or delivery — structured JSON output only. */
export async function runDryrun(cwd: string = process.cwd()): Promise<void> {
  const config = loadConfig(cwd);
  const sourceStatus = await discoverSources();

  logger.info('Dry run — fetching Coral data and running analysis (no LLM)...');

  const facts = await runAllQueries(config);

  const velocity = extractVelocitySignals(facts.velocity);
  const { workload, incident } = extractWorkloadSignals(facts.load);
  const risk = extractRiskSignals(facts.risks);
  const review = extractBottleneckSignals(facts.velocity, facts.load);
  const dora = extractDoraSignals(facts.dora);

  const signals = { velocity, review, workload, risk, incident, dora };
  const rootCauses = analyzeRootCauses(signals);
  const recommendations = generateRecommendations(rootCauses);

  console.log(
    JSON.stringify(
      {
        team: config.team.name,
        sources: sourceStatus,
        facts,
        analysis: { signals, rootCauses, recommendations },
      },
      null,
      2,
    ),
  );
}
