import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import redis from "ioredis";

export const checkAdminOrDirector = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user: User }).user;
  
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }
  
    if (user.role !== 'admin' && user.role !== 'director') {
      return res.status(403).json({ error: 'Access denied' });
    }
  
    next();
  };

export const checkRoleForEventGet = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user: User }).user;
  
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }
  
    if (user.role !== 'admin' && user.role !== 'director' && user.role !== 'employee') {
      return res.status(403).json({ error: 'Access denied' });
    }
  
    next();
};