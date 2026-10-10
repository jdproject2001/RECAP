// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// Estos datos los obtienes en la consola de Firebase (Project Settings > General > Your apps)
const firebaseConfig = {
  apiKey: "AIzaSyD_4MwzmppEa2E8tsWW4ceNqLW9B7b3nWc",
  authDomain: "recap-9c551.firebaseapp.com",
  projectId: "recap-9c551",
  storageBucket: "recap-9c551.firebasestorage.app",
  messagingSenderId: "644223341403",
  appId: "1:644223341403:web:eacaffc8a2381a5975c07e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Función helper para Iniciar Sesión con Google
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error(
    'Error al autenticar con Google:',
    {
      code: error?.code,
      message: error?.message,
      customData: error?.customData,
      name: error?.name
    }
  );
    throw error;
  }
};

// Función helper para Cerrar Sesión
export const logout = async () => {
  await signOut(auth);
};