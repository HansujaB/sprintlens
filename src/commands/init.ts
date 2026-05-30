import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../utils/logger.js';

const EXAMPLE = 'sprintlens.toml.example';
const TARGET = 'sprintlens.toml';

/** Scaffold sprintlens.toml from the example file. */
export function runInit(cwd: string = process.cwd()): void {
  const targetPath = resolve(cwd, TARGET);

  if (existsSync(targetPath)) {
    logger.warn(`${TARGET} already exists — skipping init`);
    return;
  }

  const examplePath = resolve(cwd, EXAMPLE);
  if (!existsSync(examplePath)) {
    logger.error(`Could not find ${EXAMPLE} in ${cwd}`);
    process.exitCode = 1;
    return;
  }

  copyFileSync(examplePath, targetPath);
  logger.info(`Created ${TARGET} — edit it with your team details before running report`);
}
