import assert from 'node:assert/strict';
import test from 'node:test';
import { Worker } from 'node:worker_threads';

test('robustness: compiler survives fuzz input', async () => {
  const cases = +(process.env.ROBUSTNESS_CASES ?? 100_000);
  const timeoutMs = +(process.env.ROBUSTNESS_TIMEOUT ?? 30_000);
  const seed = +(process.env.ROBUSTNESS_SEED ?? 0xac627913);

  assert.ok(Number.isInteger(cases) && cases > 0, 'ROBUSTNESS_CASES must be a positive integer');
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs > 0, 'ROBUSTNESS_TIMEOUT must be a positive integer');
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'ROBUSTNESS_SEED must be a uint32 integer');

  const worker = new Worker(new URL('./robustness.worker.js', import.meta.url), {
    workerData: { seed, cases },
  });

  await new Promise((resolve, reject) => {
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(async () => {
      try {
        await worker.terminate();
      } finally {
        finish(reject, new Error([
          `robustness test timed out after ${timeoutMs}ms`,
          `seed: ${seed}`,
          `cases: ${cases}`,
        ].join('\n')));
      }
    }, timeoutMs);

    worker.on('message', message => {
      if (message.ok) {
        finish(resolve, message);
        return;
      }

      const details = [
        `fuzz case #${message.caseIndex} failed`,
        `initial seed: ${message.initialSeed}`,
        `case seed: ${message.caseSeed}`,
        `failure state: ${message.failureState}`,
        `mode: ${message.mode}`,
        `source SHA-256: ${message.sourceSha256}`,
        `corpus file: ${message.corpusFile}`,
        '',
        message.error,
        '',
        'Source (JSON):',
        message.sourceJson,
      ];

      finish(reject, new Error(details.join('\n')));
    });

    worker.once('error', error => {
      finish(reject, error);
    });

    worker.once('exit', code => {
      if (settled) return;
      finish(reject, new Error(`robustness worker exited unexpectedly with code ${code}`));
    });
  });
});
