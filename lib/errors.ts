export const ERROR_STATUS_MAP = {
  MERCHANT_UNSUPPORTED: 422,
  INSUFFICIENT_BALANCE: 402,
  CARD_FROZEN: 409,
  QUOTE_EXPIRED: 410,
  QUOTE_MISMATCH: 400,
  INTENT_NOT_CONFIRMABLE: 409,
  INTENT_NOT_FOUND: 404,
  WALLET_NOT_FOUND: 500,
  CARD_NOT_FOUND: 500,
  VALIDATION: 400,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS_MAP;

export interface AppErrorPayload {
  code: ErrorCode;
  message?: string;
  statusCode?: number;
  details?: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(payload: AppErrorPayload) {
    super(payload.message || payload.code);
    this.name = "AppError";
    this.code = payload.code;
    this.statusCode = payload.statusCode ?? ERROR_STATUS_MAP[payload.code];
    this.details = payload.details;
  }
}
