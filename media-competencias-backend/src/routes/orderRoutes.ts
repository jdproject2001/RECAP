import { Router } from 'express';
import { createOrder } from '../controllers/orderController';

const router = Router();

router.post('/pedidos', createOrder);

export default router;