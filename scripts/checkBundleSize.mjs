#!/usr/bin/env node
/*
    Fails the build if an entry point grows past its budget.

    A reviewer called this library large. Measuring showed it was not — but
    also that nothing was stopping it becoming so, and the work to get the root
    from 5.6 kB to 3.2 kB would have decayed silently one feature at a time.

    Budgets are gzipped bytes, because that is what a browser downloads, and
    they sit a little above the current size: close enough that a real
    regression trips them, loose enough that ordinary churn does not. Raising
    one is a decision someone makes on purpose, in a diff, with a reason.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve(import.meta.dirname, '..', 'dist');

const BUDGETS = [
  // entry          budget   what it holds
  ['index.js', 3600, 'the component and the hook'],
  ['parse.js', 600, 'parsing and formatting, server-safe'],
  ['currency.js', 600, 'currency lists, search and flags'],
  ['events.js', 600, 'reading input events']
];

const gzipped = (file) => gzipSync(readFileSync(file)).length;

let failed = false;

console.log('Bundle size, gzipped:\n');

for (const [name, budget, description] of BUDGETS) {
  const file = join(DIST, name);

  if (!existsSync(file)) {
    console.error(`  ${name} is missing — did the build run?`);
    failed = true;
    continue;
  }

  const size = gzipped(file);
  const headroom = budget - size;
  const status = headroom < 0 ? 'OVER' : 'ok';

  console.log(
    `  ${status.padEnd(5)} ${name.padEnd(14)} ${String(size).padStart(5)} B` +
      ` / ${budget} B   ${description}`
  );

  if (headroom < 0) {
    console.error(
      `\n  ${name} is ${-headroom} B over budget.\n` +
        '  Either the growth is worth it — raise the budget here and say why in' +
        ' the commit —\n  or it is not, and something needs to come back out.'
    );
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
