//orderRoutes.ts
import { Router } from 'express';
import { createOrder, getMyPurchases, getOrderItemFiles, selectMaterialForOrderItem } from '../controllers/orderController';
import { authenticateFirebase } from '../middleware/authMiddleware';

const router = Router();
router.post('/', authenticateFirebase, createOrder);

router.get('/mis-compras', authenticateFirebase, getMyPurchases);

router.post('/:pedidoItemId/seleccionar-material', authenticateFirebase, selectMaterialForOrderItem);

router.get('/:pedidoItemId/archivos', authenticateFirebase, getOrderItemFiles);

export default router;