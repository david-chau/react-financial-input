#!/usr/bin/env node
/*
    Makes the emitted declarations resolvable under Node16 module resolution,
    and gives the `require` condition its own entry point.

    Two problems, both reported by arethetypeswrong and publint:

    `tsc` writes relative imports without extensions — `from '../../types'`.
    That is fine for bundlers and for the classic Node resolver, and invalid in
    ESM under `moduleResolution: node16`, where the extension is required. A
    consumer on `node16` or `nodenext` got "module was not resolved" for every
    internal import in the package.

    And a single `.d.ts` served to both conditions reads as ESM when resolved
    through `require`, so a CommonJS consumer was handed declarations that
    describe a module shape it is not getting.

    Rewriting the specifiers is deterministic and needs no bundler: TypeScript
    maps `'./x.js'` back to `x.d.ts`, which is the convention the extension is
    meant to follow. Directory imports gain `/index.js` for the same reason.
 */
import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
  copyFileSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const DIST = resolve(import.meta.dirname, '..', 'dist');

const declarationsIn = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      return declarationsIn(path);
    }

    return path.endsWith('.d.ts') ? [path] : [];
  });

/*
    A relative specifier points either at a sibling declaration or at a
    directory with an index in it. Anything else is left alone rather than
    guessed at — a wrong extension is worse than none.
 */
const withExtension = (fromFile, specifier) => {
  const target = resolve(dirname(fromFile), specifier);

  if (existsSync(`${target}.d.ts`)) {
    return `${specifier}.js`;
  }

  if (existsSync(join(target, 'index.d.ts'))) {
    return `${specifier}/index.js`;
  }

  return null;
};

let rewritten = 0;

for (const file of declarationsIn(DIST)) {
  const before = readFileSync(file, 'utf8');

  const after = before.replace(
    /(from\s+|import\s*\(\s*)'(\.[^']*)'/g,
    (match, prefix, specifier) => {
      // Already carries one, so there is nothing to add.
      if (/\.(js|cjs|mjs|json)$/.test(specifier)) {
        return match;
      }

      const fixed = withExtension(file, specifier);

      if (fixed === null) {
        return match;
      }

      rewritten += 1;

      return `${prefix}'${fixed}'`;
    }
  );

  if (after !== before) {
    writeFileSync(file, after);
  }
}

/*
    The require condition points here. The contents are identical — the
    extension is what tells TypeScript to read it as CommonJS.
 */
const entries = ['index', 'parse', 'currency', 'events'];

for (const name of entries) {
  const source = join(DIST, `${name}.d.ts`);

  if (existsSync(source)) {
    copyFileSync(source, join(DIST, `${name}.d.cts`));
  }
}

console.log(
  `declarations: ${rewritten} specifiers given extensions, ` +
    `${entries.join('.d.cts, ')}.d.cts written`
);
