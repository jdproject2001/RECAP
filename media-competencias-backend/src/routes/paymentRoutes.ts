import { Router } from 'express';
import express from 'express';
import { 
  initiatePayment, 
  renderMockGateway, 
  handleMockWebhook 
} from '../controllers/paymentController';

const router = Router();

// Necesitamos este middleware de Express para poder procesar formularios tradicionales (POST del simulador)
router.use(express.urlencoded({ extended: true }));

router.post('/payments/initiate', initiatePayment);
router.get('/payments/mock-gateway/:pedidoId/:sessionId', renderMockGateway);
router.post('/payments/mock-webhook', handleMockWebhook);

export default router;