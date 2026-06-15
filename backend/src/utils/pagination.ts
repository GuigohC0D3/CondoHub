export interface PageParams {
  page: number;
  limit: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function toSkipTake({ page, limit }: PageParams) {
  return { skip: (page - 1) * limit, take: limit };
}

export function paginate<T>(data: T[], total: number, { page, limit }: PageParams): Paginated<T> {
  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
  };
}
