import { Router } from 'express';
import { 
  getActiveEvents, 
  getEventDetails, 
  searchParticipants 
} from '../controllers/catalogController';

const router = Router();

router.get('/eventos', getActiveEvents);
router.get('/eventos/:eventId', getEventDetails);
router.get('/categorias/:categoriaId/participantes', searchParticipants);

export default router;