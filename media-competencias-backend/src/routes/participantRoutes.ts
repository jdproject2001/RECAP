import { Router } from 'express';
import { createParticipant, getParticipantWithPackages } from '../controllers/participantController';

const router = Router();

// POST /api/v1/participantes
router.post('/', createParticipant);

router.get('/:participantId', getParticipantWithPackages);

export default router;