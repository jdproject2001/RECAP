import { Router } from 'express';
import {
  generateMultimediaUploadUrl,
  confirmMultimediaUpload,
  getMultimediaPreviewUrl,
  getMultimediaByParticipante,
  getMultimediaDownloadUrl
} from '../controllers/multimediaController';
import { authenticateFirebase } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';

const router = Router();

// =====================================================
// SUBIDA DE MULTIMEDIA
// Solo ADMIN y TECNICO
// =====================================================

// Generar URL firmada para subir a R2
router.post('/upload-url', authenticateFirebase, requireRole(['admin', 'tecnico']), generateMultimediaUploadUrl);

// Confirmar que el archivo fue subido y registrarlo en BD
router.post('/confirm-upload', authenticateFirebase, requireRole(['admin', 'tecnico']), confirmMultimediaUpload);

// =====================================================
// VISUALIZACIÓN DE MATERIAL
// Usuario autenticado
// =====================================================

// Lista de previews de un participante
router.get('/participante/:participanteId', authenticateFirebase, getMultimediaByParticipante);

// Ver un preview
router.get('/:id/preview-url', authenticateFirebase, getMultimediaPreviewUrl);

// =====================================================
// DESCARGA
// La autorización específica se valida en el controller
// =====================================================
router.get('/:id/download', authenticateFirebase, getMultimediaDownloadUrl);

export default router;