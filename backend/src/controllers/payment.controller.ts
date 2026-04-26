import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  initiateNkwaCollection,
  verifyNkwaTransaction,
  isNetworkError,
  verifyWebhookSignature,
} from '../services/nkwapay.service.js';
import { io } from '../index.js';

const initiateSchema = z.object({
  rideId: z.string().uuid(),
  method: z.enum(['NKWAPAY', 'MTN', 'ORANGE', 'CASH']),
  mno: z.enum(['MTN', 'ORANGE']).optional(),
  phone: z.string().optional(),
});

function generateRef(): string {
  return `ERIDE-${crypto.randomUUID()}`;
}

export const initiatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.issues });
    return;
  }

  const { rideId, method, mno, phone } = parsed.data;
  const userId = req.user!.id;

  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) { res.status(404).json({ message: 'Ride not found' }); return; }
  if (ride.riderId !== userId) { res.status(403).json({ message: 'Forbidden' }); return; }

  const existing = await prisma.payment.findFirst({
    where: { rideId, status: { in: ['PENDING', 'SUCCESS'] } },
  });
  if (existing?.status === 'SUCCESS') {
    res.status(400).json({ message: 'Ride already paid' });
    return;
  }

  const externalRef = generateRef();
  const amount = ride.actualFare ?? ride.estimatedFare;

  if (method === 'CASH') {
    const payment = await prisma.payment.create({
      data: { userId, rideId, amount, method: 'CASH', status: 'PENDING', transactionRef: externalRef },
    });
    res.status(201).json({ payment, message: 'Cash payment recorded' });
    return;
  }

  if (!phone) { res.status(400).json({ message: 'Phone number required for mobile money' }); return; }

  try {
    const nkwaRes = await initiateNkwaCollection({ amount, phonenumber: phone, externalRef });
    const payment = await prisma.payment.create({
      data: {
        userId, rideId, amount, method, mno,
        status: 'PENDING',
        transactionRef: nkwaRes.transactionId || externalRef,
      },
    });
    res.status(201).json({ payment, nkwaStatus: nkwaRes.status });
  } catch (err) {
    const fallbackRef = generateRef();
    if (isNetworkError(err)) {
      const payment = await prisma.payment.create({
        data: { userId, rideId, amount, method: 'CASH', status: 'PENDING', transactionRef: fallbackRef },
      });
      res.status(202).json({ payment, message: 'NkwaPay unreachable. Falling back to cash.', fallback: true });
      return;
    }
    await prisma.payment.create({
      data: { userId, rideId, amount, method, mno, status: 'FAILED', transactionRef: fallbackRef },
    });
    res.status(502).json({ message: 'Payment gateway error. Please retry or use cash.' });
  }
};

export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params['id'] as string;
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) { res.status(404).json({ message: 'Payment not found' }); return; }
  if (!payment.transactionRef) { res.status(400).json({ message: 'No transaction ref' }); return; }

  try {
    const result = await verifyNkwaTransaction(payment.transactionRef);
    const status = result.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
    const updated = await prisma.payment.update({ where: { id }, data: { status } });

    if (status === 'SUCCESS') {
      await prisma.ride.update({ where: { id: payment.rideId }, data: { paymentStatus: 'SUCCESS' } });
      io.to(payment.userId).emit('payment_update', { paymentId: id, status: 'SUCCESS' });
    }
    res.json(updated);
  } catch {
    res.status(502).json({ message: 'Could not verify payment at this time.' });
  }
};

export const getPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params['id'] as string;
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) { res.status(404).json({ message: 'Payment not found' }); return; }
  res.json(payment);
};

export const nkwaWebhook = async (req: Request, res: Response): Promise<void> => {
  // 1. Immediately return HTTP 200
  res.status(200).json({ received: true });

  // 2. Process Asynchronously
  setImmediate(async () => {
    try {
      const signature = req.headers['x-signature'] as string;
      const timestamp = req.headers['x-timestamp'] as string;
      const callbackUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const reqBodyString = JSON.stringify(req.body);

      if (!signature || !timestamp) {
        console.error('Webhook missing signature or timestamp headers');
        return;
      }

      // 3. Verify RSA Signature
      const isValid = verifyWebhookSignature(reqBodyString, signature, timestamp, callbackUrl);
      if (!isValid) {
        console.error('Webhook signature verification failed');
        return;
      }

      const { transactionId, status } = req.body as { transactionId: string; status: string; externalRef: string };
      
      const payment = await prisma.payment.findFirst({ where: { transactionRef: transactionId } });
      
      // 4. Idempotency Check
      if (!payment || payment.status === 'SUCCESS') return;

      const newStatus = status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
      
      // Only update if the status is actually changing
      if (payment.status !== newStatus) {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: newStatus } });

        if (newStatus === 'SUCCESS') {
          await prisma.ride.update({ where: { id: payment.rideId }, data: { paymentStatus: 'SUCCESS' } });
          io.to(payment.userId).emit('payment_update', { paymentId: payment.id, status: 'SUCCESS' });
        }
      }
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  });
};
