import { Router } from 'express';
import express from 'express';
import {
  initiatePayment,
  renderMockGateway,
  handleMockWebhook
} from '../controllers/paymentController';
import { authenticateFirebase } from '../middleware/authMiddleware';

const router = Router();

// Procesar formularios tradicionales del simulador
router.use(express.urlencoded({ extended: true }));

// Ruta protegida: requiere usuario autenticado con Firebase
router.post(
  '/payments/initiate',
  authenticateFirebase,
  initiatePayment
);

// Rutas del simulador
router.get(
  '/payments/mock-gateway/:pedidoId/:sessionId',
  renderMockGateway
);

router.post(
  '/payments/mock-webhook',
  handleMockWebhook
);

export default router;