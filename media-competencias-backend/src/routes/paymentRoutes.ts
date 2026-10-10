import { Router } from 'express';
import { initiatePayment, confirmPayment } from '../controllers/paymentController';
import { authenticateFirebase } from '../middleware/authMiddleware';

const router = Router();

router.post('/initiate', authenticateFirebase, initiatePayment);
router.post('/confirm', authenticateFirebase, confirmPayment);

export default router;