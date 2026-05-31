import { loadConfig } from '../config/loadConfig.js';
import { discoverSources, runDoraQuery } from '../coral/client.js';
import { extractDoraSignals } from '../analysis/rootCause.js';
import { sendConfiguredEmail } from '../delivery/email.js';
import { formatDoraReport } from '../utils/formatting.js';
import { formatReportDate, DEFAULT_PERIOD_DAYS } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import type { ReportOptions } from './report.js';

/**
 * Print or email formatted DORA metrics — no LLM required.
 *
 * DORA tier classification is deterministic (industry-standard benchmarks),
 * so this command runs without an API key. It does not call runPipeline()
 * since the full LLM analysis step is unnecessary for DORA output alone.
 */
export async function runDora(options: ReportOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  logger.info('Running SprintLens DORA metrics...');

  const config = loadConfig(cwd);
  const sourceStatus = await discoverSources();
  const doraRows = await runDoraQuery(config, sourceStatus.connected);

  const dora = extractDoraSignals(doraRows);
  const teamName = config.team.name;
  const generatedAt = formatReportDate();

  const body = formatDoraReport(
    teamName,
    DEFAULT_PERIOD_DAYS,
    dora,
    sourceStatus.connected,
    sourceStatus.missing,
  );

  if (options.email) {
    const to =
      options.emailTo ??
      config.delivery?.executive_email ??
      config.delivery?.manager_email;

    if (!to) {
      throw new Error(
        'No recipient — set [delivery] executive_email or manager_email in sprintlens.toml or pass --to',
      );
    }

    const messageId = await sendConfiguredEmail(config, [to], {
      subject: `DORA Metrics — ${teamName} · ${generatedAt}`,
      body,
    });

    logger.info(`DORA report emailed to ${to} (${messageId})`);
    return;
  }

  console.log(body);
}
