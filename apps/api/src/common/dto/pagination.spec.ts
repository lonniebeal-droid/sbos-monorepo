import { describe, expect, it } from 'vitest';

import { paginate } from './pagination.dto';

describe('paginate', () => {
  it('computes meta for a middle page', () => {
    const result = paginate([1, 2], 45, 2, 20);
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('handles the first page with no previous', () => {
    const result = paginate([1], 5, 1, 20);
    expect(result.meta.hasPreviousPage).toBe(false);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.totalPages).toBe(1);
  });

  it('never reports fewer than one page', () => {
    const result = paginate([], 0, 1, 20);
    expect(result.meta.totalPages).toBe(1);
    expect(result.data).toEqual([]);
  });
});
