import { Request, Response, NextFunction } from 'express';
import { prisma } from '../Controller/mainController';
import jwt from 'jsonwebtoken';

interface User {
  id: number;
  role: string;
}

const verifyToken = (token: string, secret: string) => jwt.verify(token, secret) as jwt.JwtPayload;

const findUser = async (id: number) => await prisma.user.findUnique({ where: { id } });

export const authorizeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies['access_token']; // get token from cookies
  if (!token) {
    return res.status(403).json({ error: 'No token in your Cookies 🍪, please login first' });
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'JWT secret is not set' });
    }
    const decoded = verifyToken(token, secret);
    findUser(decoded.id).then(user => {
      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }
      (req as Request & { user: User }).user = user;
      next();
    }).catch(err => {
      return res.status(403).json({ error: 'Failed to authenticate token' });
    });
  } catch (error) {
    return res.status(403).json({ error: 'Failed to authenticate token' });
  }
};