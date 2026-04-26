import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import prisma from '../config/prisma.js';

const NKWA_BASE_URL = process.env['NKWA_BASE_URL'] ?? 'https://api.mynkwa.com';
const NKWA_API_KEY = process.env['NKWA_API_KEY'] ?? '';
const NKWA_PUBLIC_KEY = process.env['NKWA_PUBLIC_KEY'] ?? '';

interface NkwaCollectPayload {
  amount: number;
  phonenumber: string;
  externalRef: string;
}

export interface NkwaResponse {
  status: string;
  transactionId: string;
  message?: string;
}

export async function initiateNkwaCollection(
  payload: NkwaCollectPayload
): Promise<NkwaResponse> {
  const response = await axios.post<NkwaResponse>(
    `${NKWA_BASE_URL}/v1/collect`,
    payload,
    {
      headers: { 'X-API-Key': NKWA_API_KEY, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );
  return response.data;
}

export async function verifyNkwaTransaction(transactionId: string): Promise<NkwaResponse> {
  const response = await axios.get<NkwaResponse>(
    `${NKWA_BASE_URL}/v1/transactions/${transactionId}`,
    {
      headers: { 'X-API-Key': NKWA_API_KEY },
      timeout: 10000,
    }
  );
  return response.data;
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof AxiosError) {
    return (
      err.response === undefined ||
      err.code === 'ECONNABORTED' ||
      err.code === 'ETIMEDOUT'
    );
  }
  return false;
}

// ==========================
// NEW STRICT REQUIREMENTS
// ==========================

export function verifyWebhookSignature(reqBody: string, signature: string, timestamp: string, callbackUrl: string): boolean {
  try {
    const msg = timestamp + callbackUrl + reqBody;
    // Format the public key properly if it's provided as a raw base64 string
    const formattedKey = NKWA_PUBLIC_KEY.includes('BEGIN PUBLIC KEY') 
      ? NKWA_PUBLIC_KEY 
      : `-----BEGIN PUBLIC KEY-----\n${NKWA_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;
      
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(msg, 'utf8');
    return verifier.verify(formattedKey, signature, 'base64');
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

export async function checkMnoAvailability(): Promise<{ mtn: boolean, orange: boolean }> {
  try {
    const res = await axios.get(`${NKWA_BASE_URL}/v1/availability`, {
      headers: { 'X-API-Key': NKWA_API_KEY },
      timeout: 10000,
    });
    return {
      mtn: res.data?.mtn ?? true,
      orange: res.data?.orange ?? true,
    };
  } catch (e) {
    console.error('MNO Availability check failed:', e);
    // If the check fails, we assume they are available or handle accordingly. 
    // Returning true prevents total lockdown on temporary API failure.
    return { mtn: true, orange: true }; 
  }
}

export async function reconcilePendingPayments(): Promise<void> {
  try {
    // Find payments that have been pending for more than 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
        transactionRef: { not: null },
        createdAt: { lte: twoMinutesAgo },
      },
      take: 50, // Process in batches
    });

    for (const payment of pendingPayments) {
      if (!payment.transactionRef || payment.method === 'CASH') continue;

      try {
        const result = await verifyNkwaTransaction(payment.transactionRef);
        
        // Only update if status definitively changed
        if (result.status === 'SUCCESS' || result.status === 'FAILED') {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: result.status },
          });

          if (result.status === 'SUCCESS') {
            await prisma.ride.update({
              where: { id: payment.rideId },
              data: { paymentStatus: 'SUCCESS' },
            });
            // Note: In a cron job, we might not have access to the exact Socket instance directly 
            // without importing it, but since this is reconciliation, 
            // the frontend will eventually poll or the user will refresh.
          }
        }
      } catch (err) {
        // Log and continue to the next one
        console.error(`Reconciliation failed for payment ${payment.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Error during reconciliation job:', err);
  }
}
