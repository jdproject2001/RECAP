import { Router } from 'express';
import { testR2 } from '../controllers/r2testcontroller';

const router = Router();

router.get('/test-r2', testR2);

export default router;