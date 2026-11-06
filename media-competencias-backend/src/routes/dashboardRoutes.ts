import { Router } from 'express';
import { authenticateFirebase } from '../middleware/authMiddleware';
import { getEventDashboard } from '../controllers/dashboardController';

const router = Router();

// =====================================================
// DASHBOARD DE EVENTO
// =====================================================
router.get(
  '/evento/:eventoId',
  authenticateFirebase,
  getEventDashboard
);

export default router;