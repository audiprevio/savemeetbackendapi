import { Request as ExpressRequest, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { Request as CustomRequest } from '../types';

interface Request extends ExpressRequest {
  user: User;
}

const PermissionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    res.status(403).json({ error: 'User not found' });
    return next();
  }

  if (user.role === 'employee') {
    req.body.userId = user.id; 
  }

  next();
};

export default PermissionMiddleware