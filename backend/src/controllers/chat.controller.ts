import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { io } from '../index.js';

const sendSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const rideId = req.params['rideId'] as string;
  const senderId = req.user!.id;

  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.issues });
    return;
  }

  // Verify sender is part of this ride
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) { res.status(404).json({ message: 'Ride not found' }); return; }
  if (ride.riderId !== senderId && ride.driverId !== senderId) {
    res.status(403).json({ message: 'Not a participant of this ride' });
    return;
  }

  const message = await prisma.message.create({
    data: { rideId, senderId, content: parsed.data.content },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  // Broadcast to ride room via Socket.io
  io.to(`ride:${rideId}`).emit('new_message', message);

  res.status(201).json(message);
};

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  const rideId = req.params['rideId'] as string;
  const senderId = req.user!.id;

  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) { res.status(404).json({ message: 'Ride not found' }); return; }
  if (ride.riderId !== senderId && ride.driverId !== senderId) {
    res.status(403).json({ message: 'Not a participant of this ride' });
    return;
  }

  const messages = await prisma.message.findMany({
    where: { rideId },
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });

  res.json(messages);
};
