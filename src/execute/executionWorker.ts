import { Worker } from 'node:worker_threads';
import type { ExecuteOptions, ExecutionResult, ExecutionOutputLimitBehavior, ExecutionOutputLimitOptions } from '../types/interfaces';
import { ExecutionError, ExecutionErrorCode } from './executionError';
import { captureOutput, createOutputCapture, ExecutionOutputExceededLimitError, type ExecutionOutputCapture } from './outputCapture';

class ExecutionTimeoutError extends ExecutionError {
  constructor(public readonly maxExecutionTime: number) {
    super(`Execution exceeded the maximum execution time of ${maxExecutionTime}ms`, ExecutionErrorCode.EXCEED_RUNTIME_LIMIT);
  }
}

class ExecutionWorker {
  private code: string;

  constructor(code: string) {
    this.code = code;
  }

  execute(options: ExecuteOptions): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      function getOutputConfig(value: number | ExecutionOutputLimitOptions | undefined, name: string): Pick<ExecutionOutputCapture, 'limit' | 'onLimit'> {
        if (value === undefined) return { limit: undefined, onLimit: 'stop'};


        const maxOutputSize = typeof value === 'number' ? value : value.maxOutputSize;
        const onLimit = typeof value === 'number'
          ? 'stop'
          : value.onLimit ?? 'stop';

        if (onLimit !== 'halt' && onLimit !== 'stop' && onLimit !== 'roll') {
          throw new TypeError(`INVALID_${name.toUpperCase()}_LIMIT_BEHAVIOR`);
        }

        if (maxOutputSize < 0 || isNaN(maxOutputSize)) {
          return { limit: undefined, onLimit };
        }

        return { limit: Math.floor(maxOutputSize), onLimit };
      };

      const stdout = createOutputCapture({
        name: 'stdout',
        code: ExecutionErrorCode.EXCEED_STDOUT_LIMIT,
        ...getOutputConfig(options.stdout, 'stdout')
      })

      const stderr = createOutputCapture({
        name: 'stderr',
        code: ExecutionErrorCode.EXCEED_STDERR_LIMIT,
        ...getOutputConfig(options.stderr, 'stderr')
      })

      const worker = new Worker(this.code, {
        eval: true,
        stdout: true,
        stderr: true,
        resourceLimits: options.resourceLimits,
        argv: options.argv ?? []
      });

      let terminationRequested = false;

      function onHalt(target: ExecutionOutputCapture) {
        if (terminationRequested) return
        terminationRequested = true;
        reject(new ExecutionOutputExceededLimitError(target));
        worker.terminate();
      }

      worker.stdout.on('data', chunk => {
        captureOutput(stdout, chunk, onHalt)
      })

      worker.stderr.on('data', chunk => {
        captureOutput(stderr, chunk, onHalt)
      })

      if (options.maxExecutionTime > 0) {
        var timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          terminationRequested = true;
          reject(new ExecutionTimeoutError(options.maxExecutionTime));
          worker.terminate();
        }, options.maxExecutionTime);
      }

      worker.once('error', (err: Error) => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }

        const code = (err as NodeJS.ErrnoException).code === 'ERR_WORKER_OUT_OF_MEMORY'
          ? ExecutionErrorCode.EXCEED_MEMORY_LIMIT
          : ExecutionErrorCode.WORKER_ERROR;

        reject(new ExecutionError(err.message, code))
      });

      worker.once('exit', (exitCode: number) => {
        if (timeout) clearTimeout(timeout);
        captureOutput(stdout, null, onHalt);
        captureOutput(stderr, null, onHalt);
        resolve({
          stdout: stdout.output,
          stderr: stderr.output,
          exitCode,
          executionTime: Date.now() - startTime,
          outputLimitExceeded: {
            stdout: stdout.exceeded,
            stderr: stderr.exceeded
          }
        });
      });

    });
  }

}

export type { ExecutionOutputCapture }
export { ExecutionError, ExecutionTimeoutError, ExecutionOutputExceededLimitError, ExecutionWorker, ExecutionErrorCode }
