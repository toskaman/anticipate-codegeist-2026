import type { ErrorCode } from '../../packages/contracts/src/index';

export class AppError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly retryable = false, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
  }
}
export const fail = (code: ErrorCode, message: string, details?: Record<string, unknown>): never => { throw new AppError(code, message, false, details); };
