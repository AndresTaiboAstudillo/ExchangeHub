import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  /** Momento de emisión (segundos), lo agrega el JWT. */
  iat?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
