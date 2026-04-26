import { Request, Response } from 'express';
import prisma from '../config/prisma.js';

export const getPendingDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const drivers = await prisma.user.findMany({
      where: { role: 'DRIVER', status: 'PENDING' },
      include: { vehicle: true },
    });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching drivers' });
  }
};

export const approveDriver = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const driver = await prisma.user.update({
      where: { id: id as string },
      data: { status: 'APPROVED' },
    });
    res.json(driver);
  } catch (error) {
    res.status(500).json({ message: 'Error approving driver' });
  }
};

export const rejectDriver = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const driver = await prisma.user.update({
      where: { id: id as string },
      data: { status: 'REJECTED' },
    });
    res.json(driver);
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting driver' });
  }
};

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalDrivers = await prisma.user.count({ where: { role: 'DRIVER' } });
    const onlineDrivers = await prisma.user.count({ where: { role: 'DRIVER', isOnline: true } });
    const totalRiders = await prisma.user.count({ where: { role: 'RIDER' } });
    const totalRides = await prisma.ride.count();
    const completedRides = await prisma.ride.count({ where: { status: 'COMPLETED' } });
    
    const revenueAggr = await prisma.ride.aggregate({
      _sum: { actualFare: true },
      where: { status: 'COMPLETED' }
    });
    
    res.json({
      totalDrivers,
      onlineDrivers,
      totalRiders,
      totalRides,
      completedRides,
      totalRevenue: revenueAggr._sum.actualFare || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats' });
  }
};

export const getActiveRides = async (req: Request, res: Response): Promise<void> => {
  try {
    const rides = await prisma.ride.findMany({
      where: {
        status: { in: ['PENDING', 'ACCEPTED', 'ARRIVED', 'ONGOING'] }
      },
      include: { rider: true, driver: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active rides' });
  }
};
