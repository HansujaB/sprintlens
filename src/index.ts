#!/usr/bin/env node

import { runInit } from './commands/init.js';
import { runDoctor } from './commands/doctor.js';
import { runReport, runDigest } from './commands/report.js';
import { runExecutive } from './commands/executive.js';
import { runDora } from './commands/dora.js';
import { runDryrun } from './commands/dryrun.js';
import { logger } from './utils/logger.js';

const USAGE = `SprintLens — engineering team health via Coral cross-source SQL

Usage:
  sprintlens init              Create sprintlens.toml from example
  sprintlens doctor            Verify config, Coral CLI, and sources
  sprintlens report            Run full pipeline and generate manager report
  sprintlens report --email    Email manager report to [delivery] manager_email
  sprintlens digest              Print employee digests to terminal
  sprintlens digest --email      Email each engineer their digest
  sprintlens executive           Executive engineering health summary
  sprintlens executive --email   Email to [delivery] executive_email
  sprintlens dora                Formatted DORA metrics (no LLM)
  sprintlens dora --email          Email DORA metrics report
  sprintlens dryrun            Run Coral queries + analysis without LLM

Options:
  --email                      Deliver via SMTP instead of terminal
  --to <address>               Override email recipient
  --engineer <name>            Target one engineer (digest command)
  --help                       Show this help message
`;

function parseArgs(argv: string[]): {
  command: string;
  flags: { email: boolean; to?: string; engineer?: string };
} {
  const args = argv.filter((a) => a !== '--');
  const command = args[0] ?? '';
  const flags = {
    email: args.includes('--email'),
    to: args.find((a, i) => args[i - 1] === '--to'),
    engineer: args.find((a, i) => args[i - 1] === '--engineer'),
  };
  return { command, flags };
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  const emailOptions = { email: flags.email, emailTo: flags.to };

  try {
    switch (command) {
      case 'init':
        runInit();
        break;
      case 'doctor':
        await runDoctor();
        break;
      case 'report':
        await runReport(emailOptions);
        break;
      case 'digest':
        await runDigest({ ...emailOptions, engineer: flags.engineer });
        break;
      case 'executive':
        await runExecutive(emailOptions);
        break;
      case 'dora':
        await runDora(emailOptions);
        break;
      case 'dryrun':
        await runDryrun();
        break;
      default:
        logger.error(`Unknown command: ${command}`);
        console.log(USAGE);
        process.exitCode = 1;
    }
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

main();
