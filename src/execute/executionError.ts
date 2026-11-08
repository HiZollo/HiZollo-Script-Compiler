export enum ExecutionErrorCode {
  WORKER_ERROR,
  EXCEED_RUNTIME_LIMIT,
  EXCEED_MEMORY_LIMIT,
  EXCEED_STDOUT_LIMIT,
  EXCEED_STDERR_LIMIT
}

export class ExecutionError extends Error {
  constructor(message: string, public readonly code: ExecutionErrorCode) {
    super(message);
  }
}
