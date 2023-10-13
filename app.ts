import { rateLimit } from 'express-rate-limit';
import express, { Response,  NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { authorizeMiddleware } from './Middleware/AuthorizationMiddleware';
import { prisma, createEvent, requestPasswordReset } from './Controller/mainController';
import { loginUser } from './Controller/mainController';
import PermissionMiddleware from './Permissions/Permissions';
import { checkAdminOrDirector } from './Middleware/RoleCheckerMiddleware';
import { loginLimiter } from './Middleware/LimiterMiddleware';
import { lockoutingMiddleware } from './Middleware/LockoutMiddleware';
import { Request } from 'express';
import asyncHandler from 'express-async-handler';

interface CustomRequest extends Request {
  loginFailed?: boolean;
}

const app = express();

require('dotenv').config();

app.use(express.json());
app.use(cookieParser());



app.post('/login', asyncHandler(async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const tokens = await loginUser(req, res, email, password);

    res.cookie('access_token', tokens.accessToken, { maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', tokens.refreshToken, { maxAge: 7 * 60 * 60 * 1000});

    res.json(tokens);
  } catch (error) {
    if (res.locals.loginFailed) {
      lockoutingMiddleware(req, res, next);
    } else {
      const message = (error instanceof Error) ? error.message: 'An unexpected error has occured'
      res.status(400).json({ error: message });
    }
  }
}));

app.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ error: 'Email already in use' });
  }

  const hashedPassword = await bcryptjs.hash(password, 10);

  try {
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    });
    res.json({ message: 'User registered successfully', user: newUser });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while registering the user' });
  }
});

// app.post('/login', lockoutMiddleware, loginLimiter, async (req: CustomRequest, res) => {
//   try {
//     const { email, password } = req.body;
//     const tokens = await loginUser(req, email, password);

//     res.cookie('access_token', tokens.accessToken, { maxAge: 15 * 60 * 1000 });
//     res.cookie('refresh_token', tokens.refreshToken, { maxAge: 7 * 60 * 60 * 1000});

//     res.json(tokens);
//   } catch (error) {
//     const message = (error instanceof Error) ? error.message: 'An unexpected error has occured'
    
//     // If the login attempt failed, add a property to the req object
//     req.loginFailed = true;

//     res.status(400).json({ error: message });
//   }
// });


app.post('/request-password-reset', async (req, res) => {
  try {
    const token = await requestPasswordReset(req.body.email);
    res.cookie('reset_password_token', token, { maxAge: 3600000, httpOnly: true }); // 1 hour
    res.json({ message: 'Password reset token sent' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  const token = req.cookies['reset_password_token'];

  const user = await prisma.user.findUnique({ where: { email } });

  if (!token) {
    return res.status(403).json({ error: 'No token in your Cookies 🍪, please login first' });
  }

  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  const hashedPassword = await bcryptjs.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  res.clearCookie('reset_password_token');
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ message: 'Password has been reset successfully. You need to log in again' })
})

app.post('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ message: 'Logged out successfully' });
});

app.use(authorizeMiddleware);

app.get('/events', async (req, res) => {
  const user = req.user;

  if (!user) {
    return res.status(403).json({ error: 'User not found' });
  }

  try {
    let events;

    if (user.role === 'employee') {
      events = await prisma.event.findMany({
        where: {
          createdById: user.id,
        },
      });
    } else if (user.role === 'admin' || user.role === 'director') {
      events = await prisma.event.findMany();
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching events' });
  }
});

app.post('/payroll', checkAdminOrDirector, async (req, res) => {
  try {
    const { userId, hourlyRate } = req.body;
    const newPayroll = await prisma.payroll.create({
      data: {
        user: { connect: { id: userId } },
        hourlyRate: hourlyRate
      }
    });
    res.json(newPayroll);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message});
    } else {
      res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
});



  
app.post('/event', async (req, res) => {
  try {
    const { title, attendeeEmails, attendeeHourlyRates, duration, startTime, endTime, userId } = req.body;
    const newEvent = await createEvent(title, attendeeEmails, attendeeHourlyRates, duration, startTime, endTime, userId);
    const eventStartTime = new Date(startTime);
    const eventEndTime = new Date(endTime);  
    res.json
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message});
    } else {
      res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
});
app.patch('/event/:id', async (req, res) => {
  const user = req.user;

  if (!user) {
    return res.status(403).json({ error: 'User not found' });
  }

  const event = await prisma.event.findUnique({
    where: { id: Number(req.params.id) },
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (user.role !== 'admin' && user.role !== 'director' && event.createdById !== user.id) {
    return res.status(403).json({ error: 'You do not have permission to update this event' });
  }

  try {
    const {  name, attendees, duration, startTime } = req.body;
    const updatedEventData = await prisma.event.update({
      where: { id: Number(req.params.id) },
      data: { name, attendees, duration, startTime },
    });
    res.json(updatedEventData);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the event' });
  }
});

app.delete('/event/:id', async (req, res) => {
  const user = req.user;

  if (!user) {
    return res.status(403).json({ error: 'User not found' });
  }

  const event = await prisma.event.findUnique({
    where: { id: Number(req.params.id) },
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (user.role !== 'admin' && user.role !== 'director' && event.createdById !== user.id) {
    return res.status(403).json({ error: 'You do not have permission to delete this event' });
  }

  try {
    await prisma.attendee.deleteMany({
      where: { eventId: Number(req.params.id) },
    });

    await prisma.event.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error(error); 
    if (error instanceof Error) {
      res.status(500).json({ error: error.message }); 
    } else {
      res.status(500).json({ error: 'An error occurred while deleting the event' }); 
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
