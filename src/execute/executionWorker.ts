import { Worker } from 'worker_threads';
import { ExecuteOptions } from '../types/interfaces';

class ExecutionWorker {
  private code: string;

  constructor(code: string) {
    this.code = code;
  }

  execute(options: ExecuteOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(this.code, {
        eval: true,
      });

      if (options.maxExecutionTime > 0) {
        var timeout = setTimeout(() => {
          reject({ error: new Error("EXCEED_RUNTIME_LIMIT") })
          worker.terminate();
        }, options.maxExecutionTime);
      }

      worker.once('error', (err: Error) => {
        reject({
          error: err
        });
      });

      worker.once('exit', (exitCode: number) => {
        clearTimeout(timeout);
        if (exitCode === 0) resolve();
      });

    });
  }

}

export { ExecutionWorker }
