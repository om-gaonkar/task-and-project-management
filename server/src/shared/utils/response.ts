import type { Response } from 'express';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SuccessOptions {
  status?: number;
  meta?: PageMeta | Record<string, unknown>;
}

/** Success envelope: { success: true, data, meta? }. Errors use { success: false, error }. */
export function sendSuccess<T>(res: Response, data: T, options: SuccessOptions = {}): void {
  res.status(options.status ?? 200).json({
    success: true,
    data,
    ...(options.meta ? { meta: options.meta } : {}),
  });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
