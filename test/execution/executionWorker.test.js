import assert from 'node:assert/strict';
import test from 'node:test';

import { ExecutionWorker, ExecutionError, ExecutionTimeoutError, ExecutionErrorCode } from '../helpers.js';

test('executionWorker: stdout', async () => {
  const result = await new ExecutionWorker(`process.stdout.write("hello");`)
    .execute({ maxExecutionTime: 1000 });

  assert.equal(result.stdout, 'hello');
  assert.equal(result.stderr, '');
  assert.equal(result.exitCode, 0);
});

test('executionWorker: stderr', async () => {
  const result = await new ExecutionWorker(`process.stderr.write("warning");`)
    .execute({ maxExecutionTime: 1000 });

  assert.equal(result.stderr, 'warning');
  assert.equal(result.exitCode, 0);
});

test('executionWorker: argv', async () => {
  const result = await new ExecutionWorker(`process.stdout.write(process.argv.slice(2).join(","));`)
    .execute({ maxExecutionTime: 1000, argv: ['foo', 'bar'] });

  assert.equal(result.stdout, 'foo,bar');
  assert.equal(result.exitCode, 0);
});

test('executionWorker: worker failures become ExecutionError', async () => {
  await assert.rejects(
    () => new ExecutionWorker(`throw new Error("boom");`).execute({ maxExecutionTime: 1000 }),
    error => error instanceof ExecutionError && error.code === ExecutionErrorCode.WORKER_ERROR && error.message.includes('boom')
  );
});

test('ExecutionWorker rejects when execution exceeds the limit', async () => {
  await assert.rejects(
    () => new ExecutionWorker(`while (true) {}`).execute({ maxExecutionTime: 50 }),
    error => error instanceof ExecutionTimeoutError && error.code === ExecutionErrorCode.EXCEED_RUNTIME_LIMIT && error.maxExecutionTime === 50
  );
});
