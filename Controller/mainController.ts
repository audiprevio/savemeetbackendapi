import { PrismaClient, User, Event, Attendee, Payroll } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redis from '../redis';
import Express from 'express';
import { Request, Response } from 'express';

interface CustomRequest extends Request {
  loginFailed?: boolean;
}

export const prisma = new PrismaClient();



export const loginUser = async (req: CustomRequest, res: Response, email: string, password: string) => {

  const lockUntil = await new Promise<number | null>((resolve, reject) => {
    redis.get(email, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result ? Number(result) : null);
      }
    });
  });

  if (lockUntil && Date.now() < lockUntil) {
    throw new Error('You are currently locked out. Please try again later.');
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  let isPasswordValid = await bcryptjs.compare(password, user.password);
  if (!isPasswordValid) {
    res.locals.loginFailed = true;
    console.log('Login failed:', res.locals.loginFailed);
    throw new Error('Invalid email or password');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not set');
  }

  const accessToken = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });

  return {
    message: 'Login successful, you are now signed in to SAVEMEET - the calendar app that tells you how much your meeting is going to cost your company',
    accessToken,
    refreshToken,
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
  };
};

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  role: 'employee' | 'admin' | 'director'
): Promise<User> => {
  const hashedPassword = await bcryptjs.hash(password, 10);
  return prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
    },
  });
};

export const getEventsWithAttendeesAndPayrolls = async () => {
  const events = await prisma.event.findMany({
    include: {
      attendees: {
        include: {
          user: {
            include: {
              payroll: true
            }
          }
        }
      }
    }
  });

  return events.map(event => ({
    ...event,
    totalHourlyRate: event.attendees.reduce((total, attendee) => total + (attendee.user.payroll?.hourlyRate || 0), 0)
  }));
};


export const updateEvent = async (
  eventId: number,
  data: {
    title?: string,
    attendees?: string[],
    duration?: number,
    startTime?: string
  }
): Promise<Event & ({ attendees: (Attendee & { user: User })[] }) | null> => {
  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: {
      name: data.title,
      duration: data.duration,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
    },
  });

  if (data.attendees) {
    const existingAttendees = await prisma.attendee.findMany({
      where: { eventId: eventId },
    });

    await prisma.attendee.deleteMany({
      where: { eventId: eventId },
    });

    for (let email of data.attendees) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.attendee.create({
          data: {
            eventId: eventId,
            userId: user.id,
          },
        });
      }
    }
  }

  return prisma.event.findUnique({
    where: { id: eventId },
    include: { attendees: { include: { user: true } } },
  });
};

export const createEvent = async (
  name: string,
  attendeeEmails: string [],
  attendeeHourlyRates: number [],
  duration: number,
  startTime: string,
  endTime: string,
  userId: number
): Promise<(Event & { attendees: (Attendee & { user: User & { payroll: Payroll | null } })[] }) | null> => {  

  if (!attendeeEmails || attendeeEmails.length === 0) {
    throw new Error('No attendee emails provided');
  }

  const attendees = await prisma.user.findMany({
    where: {
      email: {
        in: attendeeEmails,
      },
    },
  });

  if (attendees.length !== attendeeEmails.length) {
    throw new Error('Some attendee emails do not exist in the database. Please check the DB for reference.');
  }

  for (let i = 0; i < attendees.length; i++) {
    const attendee = attendees[i];
    const hourlyRate = attendeeHourlyRates[i];
    
    const existingPayroll = await prisma.payroll.findUnique({
      where: { userId: attendee.id },
    });

    if (existingPayroll && existingPayroll.hourlyRate !== hourlyRate) {
      throw new Error('Hourly rate for attendee(s) does not match the provided hourly rate. Please check the DB for reference.')
    }

    if (existingPayroll) {
      await prisma.payroll.update({
        where: { id: existingPayroll.id },
        data: { hourlyRate },
      });
    } else {
      await prisma.payroll.create({
        data: {
          hourlyRate,
          user: { connect: { id: attendee.id } },
        },
      });
    }
  }

  const newEvent = await prisma.event.create({
    data: {
      name,
      duration,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      totalHourlyRate: attendees.reduce((total, attendee) => total + attendeeHourlyRates[attendee.id], 0),
      createdBy: { connect: { id: userId } },
      attendees: {
        create: attendees.map((attendee) => ({
          userId: attendee.id
        }))
      }
    }
  });

  const eventWithAttendeesAndPayrolls  = await prisma.event.findUnique({
    where: { id: newEvent.id },
    include: {
      attendees: {
        include: {
          user: {
            include: {
              payroll: true
            }
          }
        }
      }
    }
  });

  if (eventWithAttendeesAndPayrolls) {
    eventWithAttendeesAndPayrolls.totalHourlyRate = eventWithAttendeesAndPayrolls.attendees.reduce((total, attendee) => total + (attendee.user.payroll?.hourlyRate || 0), 0);
    

    await prisma.event.update({
      where: { id: newEvent.id },
      data: { totalHourlyRate: eventWithAttendeesAndPayrolls.totalHourlyRate },
    });
  } else {
    throw new Error('Event not found');
  }

  return eventWithAttendeesAndPayrolls;
}

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('User not found');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret is not set');
  }

  const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '1h' });

  return token;
};
