/**
 * Shared cross-module TypeScript interfaces.
 * Resource-specific types live next to their API route or feature module.
 */
import type { AppRole } from "@/lib/constants";

export interface Profile {
  id: string;
  full_name: string | null;
  student_id: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  roles: AppRole[];
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface ApiOk<T> {
  data: T;
}
