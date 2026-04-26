import { Router } from 'express';
import {
  initiatePayment,
  verifyPayment,
  getPayment,
  nkwaWebhook,
} from '../controllers/payment.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/webhook', nkwaWebhook);
router.post('/initiate', protect, initiatePayment);
router.post('/verify/:id', protect, verifyPayment);
router.get('/:id', protect, getPayment);

export default router;
