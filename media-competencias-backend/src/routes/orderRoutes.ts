//orderRoutes.ts
import { Router } from 'express';
import { createOrder } from '../controllers/orderController';
import { authenticateFirebase } from '../middleware/authMiddleware';

const router = Router();
router.post('/pedidos', authenticateFirebase, createOrder);
export default router;