/**
 * Post-build: copy SQL query files from src/ into dist/
 *
 * TypeScript only compiles .ts files. client.ts loads SQL via readFileSync
 * at runtime from __dirname/queries. After tsc, that resolves to dist/coral/queries/
 * so we must copy the .sql files there.
 *
 * Usage: node scripts/copy-sql.mjs (called automatically by "postbuild" npm hook)
 */

import { cpSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '..', 'src', 'coral', 'queries');
const dst = join(__dirname, '..', 'dist', 'coral', 'queries');

mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });

console.log('✓ SQL query files copied to dist/coral/queries/');
