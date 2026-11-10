import assert from 'node:assert/strict';
import test from 'node:test';

import { ExecutionWorker, ExecutionError, ExecutionTimeoutError, ExecutionOutputExceededLimitError, ExecutionErrorCode } from '../helpers.js';

function execute(code, options = {}) {
  return new ExecutionWorker(code).execute({
    maxExecutionTime: 1000,
    ...options
  });
}

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

test('executionWorker rejects when execution exceeds the limit', async () => {
  await assert.rejects(
    () => new ExecutionWorker(`while (true) {}`).execute({ maxExecutionTime: 50 }),
    error => error instanceof ExecutionTimeoutError && error.code === ExecutionErrorCode.EXCEED_RUNTIME_LIMIT && error.maxExecutionTime === 50
  );
});

// --------------------------------------------------
// Output limit: stop
// --------------------------------------------------

test('executionWorker: stdout stop truncates output at the grapheme limit', async () => {
  const result = await execute(`process.stdout.write("A你😩B");`, {
    stdout: {
      maxOutputSize: 3,
      onLimit: 'stop'
    }
  });

  assert.equal(result.stdout, 'A你😩');
  assert.equal(result.stderr, '');
  assert.equal(result.exitCode, 0);
  assert.equal(result.outputLimitExceeded.stdout, true);
});

test('executionWorker: output exactly at the limit is not exceeded', async () => {
  const result = await execute(`process.stdout.write("A你😩");`, {
    stdout: {
      maxOutputSize: 3,
      onLimit: 'stop'
    }
  });

  assert.equal(result.stdout, 'A你😩');
  assert.equal(result.outputLimitExceeded.stdout, false);
});

test('executionWorker: numeric output limit defaults to stop', async () => {
  const result = await execute(`process.stdout.write("abcdef");`, { stdout: 3 });

  assert.equal(result.stdout, 'abc');
  assert.equal(result.outputLimitExceeded.stdout, true);
});

test('executionWorker: stdout and stderr limits are independent', async () => {
  const result = await execute(`process.stdout.write("abcdef"); process.stderr.write("uvwxyz");`, {
    stdout: 2,
    stderr: {
      maxOutputSize: 3,
      onLimit: 'stop'
    }
  });

  assert.equal(result.stdout, 'ab');
  assert.equal(result.stderr, 'uvw');

  assert.equal(result.outputLimitExceeded.stdout, true);
  assert.equal(result.outputLimitExceeded.stderr, true);
});

test('executionWorker: zero output limit with stop', async () => {
  const result = await execute(`process.stdout.write("hello");`, {
    stdout: {
      maxOutputSize: 0,
      onLimit: 'stop'
    }
  });

  assert.equal(result.stdout, '');
  assert.equal(result.outputLimitExceeded.stdout, true);
});

// --------------------------------------------------
// Output limit: roll
// --------------------------------------------------

test('executionWorker: roll keeps the latest graphemes after multiple wraps', async () => {
  const result = await execute(`process.stdout.write("A你😩BC");`, {
    stdout: {
      maxOutputSize: 3,
      onLimit: 'roll'
    }
  });

  assert.equal(result.stdout, '😩BC');
  assert.equal(result.exitCode, 0);
  assert.equal(result.outputLimitExceeded.stdout, true);
});

test('executionWorker: roll does not mark output exceeded at the exact limit', async () => {
  const result = await execute(`process.stdout.write("A你😩");`, {
    stdout: {
      maxOutputSize: 3,
      onLimit: 'roll'
    }
  });

  assert.equal(result.stdout, 'A你😩');
  assert.equal(result.outputLimitExceeded.stdout, false);
});

test('executionWorker: zero output limit with roll', async () => {
  const result = await execute(`process.stdout.write("hello");`, {
    stdout: {
      maxOutputSize: 0,
      onLimit: 'roll'
    }
  });

  assert.equal(result.stdout, '');
  assert.equal(result.outputLimitExceeded.stdout, true);
});

// --------------------------------------------------
// Output limit: halt
// --------------------------------------------------

test('executionWorker: stdout halt rejects with ExecutionOutputExceededLimitError', async () => {
  await assert.rejects(
    () => execute(`
      process.stdout.write("overflow");
      setTimeout(() => process.stdout.write("later"), 500);
    `, {
      stdout: {
        maxOutputSize: 3,
        onLimit: 'halt'
      }
    }),
    error =>
      error instanceof ExecutionOutputExceededLimitError &&
      error.code === ExecutionErrorCode.EXCEED_STDOUT_LIMIT &&
      error.capture.name === 'stdout' &&
      error.capture.output === 'ove' &&
      error.capture.exceeded === true
  );

  await assert.rejects(
    () => execute(`
      process.stdout.write("overflow");
      setTimeout(() => process.stdout.write("later"), 500);
    `, {
      stdout: {
        maxOutputSize: 10,
        onLimit: 'halt'
      }
    }),
    error =>
      error instanceof ExecutionOutputExceededLimitError &&
      error.code === ExecutionErrorCode.EXCEED_STDOUT_LIMIT &&
      error.capture.name === 'stdout' &&
      error.capture.output === 'overflowla' &&
      error.capture.exceeded === true
  );
});

test('executionWorker: stderr halt rejects with the stderr error code', async () => {
  await assert.rejects(
    () => execute(`
      process.stderr.write("warning");
      setTimeout(() => {}, 500);
    `, {
      stderr: {
        maxOutputSize: 4,
        onLimit: 'halt'
      }
    }),
    error =>
      error instanceof ExecutionOutputExceededLimitError &&
      error.code === ExecutionErrorCode.EXCEED_STDERR_LIMIT &&
      error.capture.name === 'stderr' &&
      error.capture.output === 'warn' &&
      error.capture.exceeded === true
  );
});

// --------------------------------------------------
// Unicode and chunk boundaries
// --------------------------------------------------

test('executionWorker: StringDecoder handles UTF-8 characters split across chunks', async () => {
  const result = await execute(`
    process.stdout.write(Buffer.from([0xE4]));

    setTimeout(() => {
      process.stdout.write(Buffer.from([0xBD, 0xA0]));

      setTimeout(() => {
        process.stdout.write("!");
      }, 10);
    }, 10);
  `, {
    stdout: {
      maxOutputSize: 1,
      onLimit: 'stop'
    }
  });

  assert.equal(result.stdout, '你');
  assert.equal(result.outputLimitExceeded.stdout, true);
});

test('executionWorker: combining marks split across chunks remain one grapheme', async () => {
  const result = await execute(`
    process.stdout.write("e");

    setTimeout(() => {
      process.stdout.write("\\u0301!");
    }, 10);
  `, {
    stdout: {
      maxOutputSize: 1,
      onLimit: 'stop'
    }
  });

  assert.equal(result.stdout, 'e\u0301');
  assert.equal(result.outputLimitExceeded.stdout, true);
});

test('executionWorker: ZWJ emoji split across chunks remain one grapheme', async () => {
  const result = await execute(`
    process.stdout.write("👨‍");

    setTimeout(() => {
      process.stdout.write("👩‍👧‍👦!");
    }, 10);
  `, {
    stdout: {
      maxOutputSize: 1,
      onLimit: 'stop'
    }
  });

  assert.equal(result.stdout, '👨‍👩‍👧‍👦');
  assert.equal(result.outputLimitExceeded.stdout, true);
});

// --------------------------------------------------
// Invalid options
// --------------------------------------------------

test('executionWorker: invalid output limit behavior is rejected', async () => {
  await assert.rejects(
    () => execute(`process.stdout.write("hello");`, {
      stdout: {
        maxOutputSize: 3,
        onLimit: 'invalid'
      }
    }),
    error => error instanceof TypeError && error.message === 'INVALID_STDOUT_LIMIT_BEHAVIOR'
  );

  await assert.rejects(
    () => execute(`process.stderr.write("hello");`, {
        stderr: {
          maxOutputSize: 3,
          onLimit: 'invalid'
        }
      }),
    error => error instanceof TypeError && error.message === 'INVALID_STDERR_LIMIT_BEHAVIOR'
  );
});
