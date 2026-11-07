import { Worker } from 'worker_threads';
import type { ExecuteOptions, ExecutionResult, ExecutionOutputLimitBehavior, ExecutionOutputLimitOptions } from '../types/interfaces';

enum ExecutionErrorCode {
  WORKER_ERROR,
  EXCEED_RUNTIME_LIMIT,
  EXCEED_MEMORY_LIMIT,
  EXCEED_STDOUT_LIMIT,
  EXCEED_STDERR_LIMIT
}

class ExecutionError extends Error {
  constructor(message: string, public readonly code: ExecutionErrorCode) {
    super(message);
  }
}

interface ExecutionOutput {
  output: string;
  stopped: boolean;
  exceeded: boolean;
  name: String;
  code: ExecutionErrorCode;
  limit: number | undefined;
  onLimit: ExecutionOutputLimitBehavior;
}


class ExecutionTimeoutError extends ExecutionError {
  constructor(public readonly maxExecutionTime: number) {
    super(`Execution exceeded the maximum execution time of ${maxExecutionTime}ms`, ExecutionErrorCode.EXCEED_RUNTIME_LIMIT);
  }
}

class ExecutionOutputExceededLimitError extends ExecutionError {
  constructor(public readonly output: ExecutionOutput) {
    super(`Execution exceeded the ${output.name} output limit`, output.code);
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

      function getOutputConfig(value: number | ExecutionOutputLimitOptions | undefined, name: string): Pick<ExecutionOutput, 'limit' | 'onLimit'> {
        if (value === undefined) return { limit: undefined, onLimit: 'stop'};

        const maxOutputSize = typeof value === 'number' ? value : value.maxOutputSize;
        const onLimit = typeof value === 'number'
          ? 'stop'
          : value.onLimit ?? 'stop';

        if (onLimit !== 'halt' && onLimit !== 'stop' && onLimit !== 'roll') {
          throw new TypeError(`INVALID_${name.toUpperCase()}_LIMIT_BEHAVIOR`);
        }

        if (maxOutputSize < 0) {
          return { limit: undefined, onLimit };
        }

        return { limit: maxOutputSize, onLimit };
      };

      const stdout: ExecutionOutput = {
        output: '',
        stopped: false,
        exceeded: false,
        name: 'stdout',
        code: ExecutionErrorCode.EXCEED_STDOUT_LIMIT,
        ...getOutputConfig(options.stdout, 'stdout')
      };

      const stderr: ExecutionOutput = {
        output: '',
        stopped: false,
        exceeded: false,
        name: 'stderr',
        code: ExecutionErrorCode.EXCEED_STDERR_LIMIT,
        ...getOutputConfig(options.stderr, 'stderr')
      };

      const worker = new Worker(this.code, {
        eval: true,
        stdout: true,
        stderr: true,
        resourceLimits: options.resourceLimits,
        argv: options.argv ?? []
      });

      let terminationRequested = false;

      function captureOutput(target: ExecutionOutput, chunk: string) {
        if (target.stopped || chunk.length === 0) return;

        if (target.limit === undefined) {
          target.output += chunk;
          return;
        }

        if (target.onLimit === 'roll') {
          target.output += chunk;
          if (target.output.length > target.limit) target.exceeded = true;
          target.output = target.limit === 0 ? '' : target.output.slice(-target.limit);
          return;
        }

        const remaining = target.limit - target.output.length;
        if (remaining > 0) target.output += chunk.slice(0, remaining);

        if (chunk.length > remaining) {
          target.exceeded = true;
          target.stopped = true;

          if (target.onLimit === 'halt' && !terminationRequested) {
            terminationRequested = true;
            reject(new ExecutionOutputExceededLimitError(target));
            worker.terminate();
          }
        }
      };

      worker.stdout.on('data', chunk => {
        captureOutput(stdout, chunk.toString('utf-8'))
      })

      worker.stderr.on('data', chunk => {
        captureOutput(stderr, chunk.toString('utf-8'))
      })

      if (options.maxExecutionTime > 0) {
        var timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
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

export type { ExecutionOutput }
export { ExecutionError, ExecutionTimeoutError, ExecutionOutputExceededLimitError, ExecutionWorker, ExecutionErrorCode }
