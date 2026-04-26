import { Router } from 'express';
import { getPendingDrivers, approveDriver, rejectDriver, getStats, getActiveRides } from '../controllers/admin.controller.js';

// Note: In production, these should be protected by an isAdmin middleware.
// For MVP, we expose them so the basic HTML portal can easily call them.
const router = Router();

router.get('/drivers', getPendingDrivers);
router.get('/stats', getStats);
router.patch('/drivers/:id/approve', approveDriver);
router.patch('/drivers/:id/reject', rejectDriver);
router.get('/active-rides', getActiveRides);

export default router;
