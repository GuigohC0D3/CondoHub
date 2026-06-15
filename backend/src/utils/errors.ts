export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS[code];
    this.details = details;
  }

  static unauthorized(message = 'Não autenticado') {
    return new AppError('UNAUTHORIZED', message);
  }
  static forbidden(message = 'Sem permissão') {
    return new AppError('FORBIDDEN', message);
  }
  static notFound(message = 'Recurso não encontrado') {
    return new AppError('NOT_FOUND', message);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError('CONFLICT', message, details);
  }
  static business(message: string, details?: unknown) {
    return new AppError('BUSINESS_RULE', message, details);
  }
}
