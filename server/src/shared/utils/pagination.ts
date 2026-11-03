import { z } from 'zod';
import type { PageMeta } from './response';

export const MAX_PAGE_SIZE = 100;

/** Reusable query schema for every list endpoint. Extend it per module. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function getSkip({ page, pageSize }: PaginationQuery): number {
  return (page - 1) * pageSize;
}

export function buildPageMeta({ page, pageSize }: PaginationQuery, total: number): PageMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
