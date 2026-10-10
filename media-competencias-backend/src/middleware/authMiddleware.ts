//auth.middleware
import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../config/firebaseAdmin';

export interface AuthenticatedRequest extends Request {
  firebaseUser?: {
    uid: string;
    email: string | undefined;
  };
  userRoles?: number[];
}

export const authenticateFirebase = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'No se proporcionó un token de autenticación.'
      });
      return;
    }

    const token = authHeader.substring(7);

    const decodedToken = await adminAuth.verifyIdToken(token);

    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };

    next();
  } catch (error) {
    console.error('Error verificando token de Firebase:', error);

    res.status(401).json({
      error: 'Token de autenticación inválido o expirado.'
    });
  }
};