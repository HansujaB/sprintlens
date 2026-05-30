import { loadConfig, listEngineers } from '../config/loadConfig.js';
import { discoverSources, runAllQueries } from '../coral/client.js';
import { extractVelocitySignals } from '../analysis/velocity.js';
import { extractWorkloadSignals } from '../analysis/workload.js';
import { extractRiskSignals } from '../analysis/risks.js';
import { extractBottleneckSignals } from '../analysis/bottlenecks.js';
import { extractDoraSignals, analyzeRootCauses } from '../analysis/rootCause.js';
import { generateRecommendations } from '../analysis/recommendations.js';
import { generateManagerReport } from '../reports/manager.js';
import { generateEmployeeDigest } from '../reports/employee.js';
import { sendConfiguredEmail } from '../delivery/email.js';
import { formatEmployeeDigest, formatManagerReport } from '../utils/formatting.js';
import { DEFAULT_PERIOD_DAYS, formatReportDate, nowIso } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import type { SprintLensConfig } from '../types/config.js';
import type { AnalysisResult, CoralSourceStatus } from '../types/signals.js';
import type { ReportMetadata } from '../types/report.js';

export interface ReportOptions {
  cwd?: string;
  apiKey?: string;
  dryRun?: boolean;
  email?: boolean;
  emailTo?: string;
}

export interface PipelineResult {
  config: SprintLensConfig;
  sourceStatus: CoralSourceStatus;
  metadata: ReportMetadata;
  analysis: AnalysisResult;
}

export interface DigestOptions extends ReportOptions {
  engineer?: string;
}

/** Run Coral queries and deterministic analysis — shared by report and digest. */
export async function runPipeline(cwd: string): Promise<PipelineResult> {
  const config = loadConfig(cwd);
  const sourceStatus = await discoverSources();
  const facts = await runAllQueries(config);

  const velocity = extractVelocitySignals(facts.velocity);
  const { workload, incident } = extractWorkloadSignals(facts.load);
  const risk = extractRiskSignals(facts.risks);
  const review = extractBottleneckSignals(facts.velocity, facts.load);
  const dora = extractDoraSignals(facts.dora);

  const signals = { velocity, review, workload, risk, incident, dora };
  const rootCauses = analyzeRootCauses(signals);
  const recommendations = generateRecommendations(rootCauses);

  const metadata: ReportMetadata = {
    teamName: config.team.name,
    generatedAt: formatReportDate(),
    periodDays: DEFAULT_PERIOD_DAYS,
    sourcesQueried: sourceStatus.connected,
    sourcesMissing: sourceStatus.missing,
  };

  return {
    config,
    sourceStatus,
    metadata,
    analysis: { signals, rootCauses, recommendations },
  };
}

/** Full pipeline: Coral → analysis → report → terminal or email. */
export async function runReport(options: ReportOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  logger.info(`Running SprintLens report...`);

  const { config, metadata, analysis } = await runPipeline(cwd);

  if (options.dryRun) {
    console.log(JSON.stringify({ metadata, analysis }, null, 2));
    return;
  }

  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn('No ANTHROPIC_API_KEY — outputting structured analysis only');
    console.log(JSON.stringify({ metadata, analysis }, null, 2));
    return;
  }

  const report = await generateManagerReport(metadata, analysis, apiKey);
  const body = formatManagerReport(report);

  if (options.email) {
    const to = options.emailTo ?? config.delivery?.manager_email;
    if (!to) {
      throw new Error(
        'No recipient — set [delivery] manager_email in sprintlens.toml or pass --to',
      );
    }

    const messageId = await sendConfiguredEmail(config, [to], {
      subject: `Sprint Health — ${metadata.teamName} · ${metadata.generatedAt}`,
      body,
    });

    logger.info(`Manager report emailed to ${to} (${messageId})`);
    return;
  }

  console.log(body);
  logger.info(`Report generated at ${nowIso()}`);
}

/** Generate and optionally email employee digests. */
export async function runDigest(options: DigestOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for employee digests');
  }

  const { config, metadata, analysis } = await runPipeline(cwd);
  const engineers = listEngineers(config).filter(([name]) =>
    options.engineer ? name === options.engineer : true,
  );

  if (engineers.length === 0) {
    throw new Error(
      options.engineer
        ? `Engineer "${options.engineer}" not found in sprintlens.toml`
        : 'No engineers configured',
    );
  }

  for (const [name, identity] of engineers) {
    const digest = await generateEmployeeDigest(metadata, analysis, name, apiKey);
    const body = formatEmployeeDigest(digest);

    if (options.email) {
      const messageId = await sendConfiguredEmail(config, [identity.email], {
        subject: `Your SprintLens digest — ${metadata.teamName}`,
        body,
      });

      logger.info(`Digest emailed to ${name} <${identity.email}> (${messageId})`);
    } else {
      console.log(body);
      console.log('');
    }
  }
}
