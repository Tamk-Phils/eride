import { Router } from 'express';
import { requestRide, updateRideStatus, getRide, getRideHistory, rateRide, estimateRide, getPendingRides, rejectRide } from '../controllers/ride.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/history', protect, getRideHistory);
router.get('/pending', protect, authorize('DRIVER'), getPendingRides);
router.post('/estimate', protect, authorize('RIDER'), estimateRide);
router.post('/request', protect, authorize('RIDER'), requestRide);
router.patch('/:id/status', protect, updateRideStatus);
router.post('/:id/reject', protect, authorize('DRIVER'), rejectRide);
router.post('/:id/rate', protect, rateRide);
router.get('/:id', protect, getRide);

export default router;
