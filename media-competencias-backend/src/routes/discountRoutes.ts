import { Router } from 'express';
import { validateDiscount } from '../controllers/discountController';

const router = Router();

router.post('/validar', validateDiscount);

export default router;