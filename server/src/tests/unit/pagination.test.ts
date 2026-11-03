import { describe, expect, it } from 'vitest';
import { buildPageMeta, getSkip, paginationQuerySchema } from '../../shared/utils/pagination';

describe('pagination helpers', () => {
  it('applies defaults and coerces query strings', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('caps the page size', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('computes skip and page metadata', () => {
    expect(getSkip({ page: 3, pageSize: 20 })).toBe(40);
    expect(buildPageMeta({ page: 1, pageSize: 20 }, 45)).toEqual({
      page: 1,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
    expect(buildPageMeta({ page: 1, pageSize: 20 }, 0).totalPages).toBe(1);
  });
});
