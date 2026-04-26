import cron from 'node-cron';
import { reconcilePendingPayments, checkMnoAvailability } from '../services/nkwapay.service.js';

export function initCronJobs() {
  console.log('🕒 Initializing Cron Jobs...');

  // MNO Availability Check: Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 Running MNO availability check...');
    const status = await checkMnoAvailability();
    console.log('MNO Status:', status);
  });

  // Reconcile Pending Payments: Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔄 Running payment reconciliation...');
    await reconcilePendingPayments();
  });
}
