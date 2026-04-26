import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma.js';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(9),
  password: z.string().min(6),
  role: z.enum(['RIDER', 'DRIVER']),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vehicleType: z.enum(['ECONOMY', 'STANDARD', 'PREMIUM']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const generateToken = (id: string, role: string): string => {
  return jwt.sign({ id, role }, process.env['JWT_SECRET'] ?? 'secret', {
    expiresIn: '30d',
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const validation = registerSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ errors: validation.error.issues });
    return;
  }

  const { name, email, phone, password, role } = validation.data;

  try {
    const userExists = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });

    if (userExists) {
      res.status(400).json({ message: 'User already exists with this email or phone' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userStatus = role === 'DRIVER' ? 'PENDING' : 'APPROVED';

    const user = await prisma.user.create({
      data: { name, email, phone, password: hashedPassword, role, status: userStatus },
    });

    if (role === 'DRIVER') {
      if (!validation.data.vehicleMake || !validation.data.vehicleModel || !validation.data.vehiclePlate) {
        res.status(400).json({ message: 'Vehicle details are required for drivers' });
        return;
      }
      await prisma.vehicle.create({
        data: {
          driverId: user.id,
          make: validation.data.vehicleMake,
          model: validation.data.vehicleModel,
          licensePlate: validation.data.vehiclePlate,
          type: validation.data.vehicleType || 'STANDARD',
        }
      });
    }

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      token: generateToken(user.id, user.role),
    });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const validation = loginSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ errors: validation.error.issues });
    return;
  }

  const { email, password } = validation.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        token: generateToken(user.id, user.role),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).user.id },
      select: { id: true, name: true, email: true, role: true, status: true }
    });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
};

export const toggleOnlineStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { isOnline } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { isOnline }
  });
  res.json({ isOnline: user.isOnline });
};
