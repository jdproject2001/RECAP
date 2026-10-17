import { Router } from 'express';
import { 
  getActiveEvents, 
  getEventWithParticipants, // <-- DEBE ESTAR IMPORTADA AQUÍ
  getEventDetails,
  searchParticipants,
  getParticipantPackagesDetails,
  getEventCategories,
  getEventoBySlug
} from '../controllers/eventController';

const router = Router();

// 1. Ruta para listar todos los eventos (Home)
router.get('/', getActiveEvents);

// 2. Ruta principal del evento (LA QUE USA EVENTPAGE.TSX)
// 🚨 Revisa que esta línea diga 'getEventWithParticipants'
router.get('/:eventId', getEventWithParticipants);

router.get('/slug/:slug', getEventoBySlug);

// 3. Ruta para los paquetes (Si la necesitas para el checkout)
router.get('/:eventId/paquetes', getEventDetails);

// 4. Ruta para buscar participantes
router.get('/categorias/:categoriaId/participantes', searchParticipants);

//5. Ruta para ver los paquetes
router.get('/:eventId/participantes/:participantId', getParticipantPackagesDetails);

router.get('/:eventId/categorias', getEventCategories);

export default router;