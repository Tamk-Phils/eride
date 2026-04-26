import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { io } from '../index.js';
import { dispatchService } from '../services/dispatch.service.js';

const FARE_BASE = 1000;
const FARE_PER_KM = 400;

function estimateFare(distanceKm: number): number {
  return Math.round(FARE_BASE + distanceKm * FARE_PER_KM);
}

export const estimateRide = async (req: AuthRequest, res: Response): Promise<void> => {
  const { distanceKm } = req.body;
  if (typeof distanceKm !== 'number') { res.status(400).json({ message: 'distanceKm is required' }); return; }

  let baseFare = estimateFare(distanceKm);

  const activeRiders = await prisma.ride.count({ where: { status: 'PENDING' } });
  const onlineDrivers = await prisma.user.count({ where: { role: 'DRIVER', isOnline: true } });
  if (activeRiders > 0 && onlineDrivers > 0 && (activeRiders / onlineDrivers) > 1.5) {
    baseFare = Math.round(baseFare * 1.2);
  }

  res.json({
    ECONOMY: baseFare,
    STANDARD: Math.round(baseFare * 1.2),
    PREMIUM: Math.round(baseFare * 2.0),
  });
};

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const requestSchema = z.object({
  pickupLat: z.number(),
  pickupLng: z.number(),
  pickupAddress: z.string(),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  dropoffAddress: z.string(),
  paymentMethod: z.enum(['NKWAPAY', 'MTN', 'ORANGE', 'CASH']).default('CASH'),
  vehicleType: z.enum(['ECONOMY', 'STANDARD', 'PREMIUM']).default('STANDARD'),
});

export const requestRide = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.issues });
    return;
  }

  const { pickupLat, pickupLng, pickupAddress, dropoffLat, dropoffLng, dropoffAddress, paymentMethod, vehicleType } = parsed.data;

  const existing = await prisma.ride.findFirst({
    where: { riderId: req.user!.id, status: { in: ['PENDING', 'ACCEPTED', 'ONGOING'] } },
  });
  if (existing) {
    res.status(400).json({ message: 'You already have an active ride' });
    return;
  }

  const distanceKm = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  let estimatedFare = estimateFare(distanceKm);

  // Dynamic Pricing (Surge): If riders outnumber online drivers
  const activeRiders = await prisma.ride.count({ where: { status: 'PENDING' } });
  const onlineDrivers = await prisma.user.count({ where: { role: 'DRIVER', isOnline: true } });
  if (activeRiders > 0 && onlineDrivers > 0 && (activeRiders / onlineDrivers) > 1.5) {
    estimatedFare = Math.round(estimatedFare * 1.2); // 20% surge
  }

  // Vehicle Tier Multipliers
  if (vehicleType === 'STANDARD') estimatedFare = Math.round(estimatedFare * 1.2);
  if (vehicleType === 'PREMIUM') estimatedFare = Math.round(estimatedFare * 2.0);

  const ride = await prisma.ride.create({
    data: {
      riderId: req.user!.id,
      pickupLocation: { lat: pickupLat, lng: pickupLng, address: pickupAddress },
      dropoffLocation: { lat: dropoffLat, lng: dropoffLng, address: dropoffAddress },
      estimatedFare,
      paymentMethod,
      requestedType: vehicleType,
    },
  });

  dispatchService.startDispatch(ride);
  res.status(201).json(ride);
};

export const updateRideStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params['id'] as string;
  const { status } = req.body as { status: string };

  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride) { res.status(404).json({ message: 'Ride not found' }); return; }

  // First-accept locking logic
  if (status === 'ACCEPTED' && ride.status !== 'PENDING') {
    res.status(400).json({ message: 'Ride already accepted by another driver' });
    return;
  }

  const updated = await prisma.ride.update({
    where: { id },
    data: {
      status: status as 'PENDING' | 'ACCEPTED' | 'ARRIVED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED',
      driverId: status === 'ACCEPTED' ? req.user!.id : undefined,
      actualFare: status === 'COMPLETED' ? ride.estimatedFare : undefined,
    },
  });

  if (status === 'ACCEPTED') {
    dispatchService.handleDriverAccept(id, req.user!.id);
  } else if (status === 'CANCELLED') {
    dispatchService.cancelDispatch(id);
  }

  io.to(`ride:${id}`).emit('ride_update', { rideId: id, status });
  io.to(ride.riderId).emit('ride_update', { rideId: id, status });
  res.json(updated);
};

export const rejectRide = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params['id'] as string;
  dispatchService.handleDriverReject(id, req.user!.id);
  res.json({ success: true });
};

export const getRide = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params['id'] as string;
  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      rider: { select: { name: true, phone: true } },
      driver: { select: { name: true, phone: true } },
    },
  });
  if (!ride) { res.status(404).json({ message: 'Ride not found' }); return; }
  res.json(ride);
};

export const getPendingRides = async (req: AuthRequest, res: Response): Promise<void> => {
  const rides = await prisma.ride.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  // Map to match the RideRequest interface expected by mobile app
  const mapped = rides.map(r => ({
    rideId: r.id,
    pickup: r.pickupLocation,
    estimatedFare: r.estimatedFare,
    requestedType: r.requestedType || 'STANDARD',
  }));
  res.json(mapped);
};

export const getRideHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  const isDriver = req.user!.role === 'DRIVER';
  const rides = await prisma.ride.findMany({
    where: isDriver ? { driverId: req.user!.id } : { riderId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    include: {
      rider: { select: { name: true } },
      driver: { select: { name: true } },
    },
  });
  res.json(rides);
};

export const rateRide = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params['id'] as string;
  const { rating, review } = req.body as { rating: number, review?: string };
  const isDriver = req.user!.role === 'DRIVER';

  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride) { res.status(404).json({ message: 'Ride not found' }); return; }

  const updated = await prisma.ride.update({
    where: { id },
    data: isDriver ? { riderRating: rating, review } : { driverRating: rating, review },
  });

  res.json(updated);
};
