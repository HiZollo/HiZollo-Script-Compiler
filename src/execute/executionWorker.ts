import { Worker } from 'worker_threads';
import { ExecuteOptions, ExecutionResult } from '../types/interfaces';

enum ExecutionErrorCode {
  WORKER_ERROR,
  EXCEED_RUNTIME_LIMIT
}

class ExecutionError extends Error {
  constructor(message: string, public readonly code: ExecutionErrorCode) {
    super(message);
  }
}

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

      const worker = new Worker(this.code, {
        eval: true,
        stdout: true,
        stderr: true,
        argv: options.argv ?? []
      });

      let stdout = '';
      let stderr = '';

      worker.stdout.on('data', chunk => {
        stdout += chunk.toString()
      })

      worker.stderr.on('data', chunk => {
        stderr += chunk.toString()
      })

      if (options.maxExecutionTime > 0) {
        var timeout = setTimeout(() => {
          reject(new ExecutionTimeoutError(options.maxExecutionTime));
          worker.terminate();
        }, options.maxExecutionTime);
      }

      worker.once('error', (err: Error) => {
        if (timeout) clearTimeout(timeout);
        reject(new ExecutionError(err.message, ExecutionErrorCode.WORKER_ERROR));
      });

      worker.once('exit', (exitCode: number) => {
        clearTimeout(timeout);
        resolve({
          stdout,
          stderr,
          exitCode,
          executionTime: Date.now() - startTime
        });
      });

    });
  }

}

export { ExecutionError, ExecutionTimeoutError, ExecutionWorker, ExecutionErrorCode }
