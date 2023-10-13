import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from "@prisma/client";
import redis from '../redis';
const prisma = new PrismaClient();
interface CustomRequest extends Request {
    loginFailed?: boolean;
  }

  export const lockoutingMiddleware = (req: CustomRequest, res: Response, next: NextFunction) => {
    const { email } = req.body;
  
    console.log('Lockout middleware called');
  
    // Check if the user is locked out
    redis.get(email, (err, lockoutTime) => {
      if (err) {
        return res.status(500).json({ error: 'An error occurred while checking the lockout status' });
      }
  
      console.log('Lockout time:', lockoutTime);
  
      if (lockoutTime && Date.now() < Number(lockoutTime)) {
        // The user is locked out, return an error response
        return res.status(429).json({ error: 'Too many failed login attempts, please try again later' });
      }
  
      // If the login attempt failed, increment the attempt count in Redis and set the lockout time if necessary
      if (res.locals.loginFailed) {
        redis.incr(`${email}:attempts`, (err, attempts) => {
          if (err) {
            console.log('Error incrementing attempt count:', err);
            return res.status(500).json({ error: 'An error occurred while incrementing the attempt count' });
          }
  
          console.log('Attempt count:', attempts);
  
          if (attempts && attempts > 2) {
            redis.set(email, Date.now() + 300 * 1000);
          }
  
          return res.status(400).json({ error: 'Invalid email or password' });
        });
      }
    });
  };