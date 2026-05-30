import { sendConfiguredEmail } from '../delivery/email.js';
import { formatDoraReport } from '../utils/formatting.js';
import { logger } from '../utils/logger.js';
import { runPipeline, type ReportOptions } from './report.js';

/** Print or email formatted DORA metrics — no LLM required. */
export async function runDora(options: ReportOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  logger.info('Running SprintLens DORA metrics...');

  const { config, metadata, analysis } = await runPipeline(cwd);
  const body = formatDoraReport(
    metadata.teamName,
    metadata.periodDays,
    analysis.signals.dora,
    metadata.sourcesQueried,
    metadata.sourcesMissing,
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
      subject: `DORA Metrics — ${metadata.teamName} · ${metadata.generatedAt}`,
      body,
    });

    logger.info(`DORA report emailed to ${to} (${messageId})`);
    return;
  }

  console.log(body);
}
