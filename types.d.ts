import { User } from '@prisma/client';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}
declare namespace Express {
    export interface Request {
      user?: User;
      loginFailed?: boolean;
    }
  }
  
export type Request = Express.Request;