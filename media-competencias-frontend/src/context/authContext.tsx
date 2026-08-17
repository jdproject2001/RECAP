// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type User, onAuthStateChanged } from "firebase/auth";
import { auth, loginWithGoogle, logout } from "../firebase/firebase";
import { API_BASE } from '../config/api';

// Tipo con la estructura actualizada de tu tabla 'usuarios'
export interface DBUser {
  id: string;
  firebase_uid: string;
  email: string;
  nombre?: string;
  apellido?: string;
  celular?: string;
  roles?: string[];
  fecha_creacion?: string;
}

interface AuthContextType {
  user: User | null;         // Usuario provisto por Firebase
  dbUser: DBUser | null;     // Usuario registrado en tu base de datos PostgreSQL
  loading: boolean;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DBUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Función para sincronizar con tu Backend Node.js / Express
  const syncUserWithBackend = async (firebaseUser: User) => {
  try {
    // Obtener el token firmado por Firebase
    const idToken = await firebaseUser.getIdToken();

    const res = await fetch(`${API_BASE}/auth/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
      }),
    });

    if (!res.ok) {
      throw new Error("Error en la respuesta del servidor de base de datos");
    }

    const data = await res.json();
    setDbUser(data.usuario);
  } catch (error) {
    console.error("Error al sincronizar el usuario con la BD:", error);
    setDbUser(null);
  }
};

  useEffect(() => {
    // Escucha en tiempo real si el usuario inicia o cierra sesión
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Si hay un usuario autenticado en Firebase, lo sincronizamos con PostgreSQL
        await syncUserWithBackend(currentUser);
      } else {
        // Si cierra sesión, limpiamos el estado de la BD
        setDbUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, dbUser, loading, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}