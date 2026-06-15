import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: UserRole;
  condominiumId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
