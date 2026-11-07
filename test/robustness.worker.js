import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { workerData, parentPort } from 'node:worker_threads';
import { createCompiler } from './helpers.js';

const { seed: initialSeed, cases } = workerData;
const corpusDirectory = new URL('./corpus/', import.meta.url);

await mkdir(corpusDirectory, { recursive: true });

class RNG {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  next() {
    let x = this.state;

    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;

    this.state = x >>> 0;

    return this.state;
  }

  int(max) {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error(`Invalid RNG max: ${max}`);
    }

    return this.next() % max;
  }

  chance(percent) {
    return this.int(100) < percent;
  }

  pick(array) {
    if (!array.length) throw new Error('Cannot pick from an empty array');
    return array[this.int(array.length)];
  }
}

const rng = new RNG(initialSeed);

const RANDOM_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  '0123456789' +
  ' \t\r\n\0' +
  '_+-*/=<>&!?|$.,:;#\'"()[]{}' +
  '\\';

const RANDOM_UNICODE = [
  '你',
  '好',
  '世',
  '界',
  '嗨',
  '小',
  '佐',
  'λ',
  'ß',
  'é',
  '😩',
  '🦠',
];

const MUTATION_TOKENS = [
  '',
  ' ',
  '\n',
  '\r\n',
  '\t',
  '<<<',
  '>>>',
  ':=',
  '==',
  '!=',
  '<=',
  '>=',
  '<->',
  '->',
  '->|',
  '+++',
  '---',
  '///',
  '[[[',
  ']]]',
  '{{{',
  '}}}',
  '"""',
  '\\',
];

async function loadExamples() {
  const examplesDirectory = new URL('../examples/', import.meta.url);

  const files = (await readdir(examplesDirectory))
    .filter(name => name.endsWith('.hzs'))
    .sort();

  return Promise.all(files.map(async name => {
    return { 
      name, 
      source: await readFile(new URL(name, examplesDirectory), 'utf8')
    }
  }));
}

const examples = await loadExamples();

function randomNoise() {
  const length = rng.int(256) + 1;

  let output = '';

  for (let i = 0; i < length; i++) {
    if (rng.chance(2)) {
      output += rng.pick(RANDOM_UNICODE);
    } else {
      output += RANDOM_CHARS[rng.int(RANDOM_CHARS.length)];
    }
  }

  return output;
}

function mutate(source, operations) {
  let result = source;

  for (let i = 0; i < operations; i++) {
    if (result.length === 0 || rng.chance(35)) {
      // Insert random content.
      const position = rng.int(result.length + 1);

      const insertion = rng.chance(50) ?
        rng.pick(MUTATION_TOKENS) :
        randomNoise().slice(0, 16);

      result = result.slice(0, position) + insertion + result.slice(position);

      continue;
    }

    if (rng.chance(30)) {
      // Delete a random range.
      const start = rng.int(result.length);
      const length = rng.int(Math.min(32, result.length - start)) + 1
      result = result.slice(0, start) + result.slice(start + length);
      continue;
    }

    if (rng.chance(25)) {
      // Replace a random range.
      const start = rng.int(result.length);
      const length = rng.int(Math.min(32, result.length - start)) + 1

      const replacement = rng.chance(50)
        ? rng.pick(MUTATION_TOKENS)
        : randomNoise().slice(0, 16);

      result = result.slice(0, start) + replacement + result.slice(start + length);
      continue;
    }

    // Duplicate a random line.
    const lines = result.split(/\r?\n/);

    if (lines.length > 0) {
      const index = rng.int(lines.length);
      lines.splice(index, 0, lines[index]);
      result = lines.join('\n');
    }
  }

  // Prevent a single case from becoming enormous.
  return result.slice(0, 65536);
}

function generateSource() {
  if (rng.chance(20)) {
    return {
      mode: 'noise',
      source: randomNoise(),
    };
  }

  const example = rng.pick(examples);
  const mutationType = rng.int(100);

  if (mutationType < 60) {
    return {
      mode: `light-mutation:${example.name}`,
      source: mutate(example.source, 1 + rng.int(3)),
    };
  }

  if (mutationType < 95) {
    return {
      mode: `medium-mutation:${example.name}`,
      source: mutate(example.source, 4 + rng.int(3)),
    };
  }

  return {
    mode: `heavy-mutation:${example.name}`,
    source: mutate(example.source, 7 + rng.int(4)),
  };
}

function sourceHash(source) {
  return createHash('sha256')
    .update(source, 'utf8')
    .digest('hex');
}

async function saveFailure({
  caseIndex,
  caseSeed,
  failureState,
  mode,
  source,
  error,
}) {
  const hash = sourceHash(source);
  const prefix = `failure-${caseIndex}-${caseSeed}-${hash.slice(0, 16)}`;
  const sourceUrl = new URL(`${prefix}.hzs`, corpusDirectory);
  const metadataUrl = new URL(`${prefix}.json`, corpusDirectory);

  const metadata = {
    caseIndex,
    initialSeed,
    caseSeed,
    failureState,
    mode,
    sourceSha256: hash,
    sourceBytes: Buffer.byteLength(source, 'utf8'),
    error: error instanceof Error ?
      { name: error.name, message: error.message, stack: error.stack ?? null } : 
      { name: 'UnknownError', message: String(error), stack: null },
    sourceJson: JSON.stringify(source),
  };

  await writeFile(sourceUrl, source, 'utf8');
  await writeFile(metadataUrl, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return { sourceUrl, metadataUrl, hash };
}

async function run() {
  const compiler = createCompiler();

  for (let caseIndex = 0; caseIndex < cases; caseIndex++) {
    const caseSeed = rng.state;
    const { mode, source } = generateSource();

    try {
      compiler.compile(source);
    } catch (error) {
      const saved = await saveFailure({
        caseIndex,
        caseSeed,
        failureState: rng.state,
        mode,
        source,
        error,
      });

      parentPort.postMessage({
        ok: false,
        caseIndex,
        initialSeed,
        caseSeed,
        failureState: rng.state,
        mode,
        source,
        sourceJson: JSON.stringify(source),
        sourceSha256: saved.hash,
        corpusFile: saved.sourceUrl.pathname,
        metadataFile: saved.metadataUrl.pathname,
        error: error instanceof Error
          ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
          : String(error),
      });

      return;
    }
  }

  parentPort.postMessage({ ok: true, initialSeed, cases });
}

run().catch(async error => {
  parentPort.postMessage({
    ok: false,
    caseIndex: null,
    initialSeed,
    caseSeed: null,
    failureState: rng.state,
    mode: 'worker',
    source: '',
    sourceJson: JSON.stringify(''),
    sourceSha256: sourceHash(''),
    corpusFile: null,
    metadataFile: null,
    error: error instanceof Error ?
      `${error.name}: ${error.message}\n${error.stack ?? ''}` :
      String(error)
  });
});
