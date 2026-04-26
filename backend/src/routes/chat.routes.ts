import { Router } from 'express';
import { sendMessage, getMessages } from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.post('/', protect, sendMessage);
router.get('/', protect, getMessages);

export default router;
