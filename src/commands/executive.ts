import { generateExecutiveReport } from '../reports/executive.js';
import { sendConfiguredEmail } from '../delivery/email.js';
import { formatExecutiveReport } from '../utils/formatting.js';
import { nowIso } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import { runPipeline, type ReportOptions } from './report.js';

/** Generate and optionally email an executive engineering health summary. */
export async function runExecutive(options: ReportOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for executive reports');
  }

  logger.info('Running SprintLens executive report...');

  const { config, metadata, analysis } = await runPipeline(cwd);
  const report = await generateExecutiveReport(metadata, analysis, apiKey);
  const body = formatExecutiveReport(report);

  if (options.email) {
    const to =
      options.emailTo ??
      config.delivery?.executive_email ??
      config.delivery?.manager_email;

    if (!to) {
      throw new Error(
        'No recipient — set [delivery] executive_email in sprintlens.toml or pass --to',
      );
    }

    const messageId = await sendConfiguredEmail(config, [to], {
      subject: `Engineering Health — ${metadata.teamName} · ${metadata.generatedAt}`,
      body,
    });

    logger.info(`Executive report emailed to ${to} (${messageId})`);
    return;
  }

  console.log(body);
  logger.info(`Executive report generated at ${nowIso()}`);
}
