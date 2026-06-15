export type Role = 'SUPER_ADMIN' | 'SINDICO' | 'MORADOR' | 'PORTEIRO';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  condominiumId: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
