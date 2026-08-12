import { useState } from "react";
//import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Lock, User as UserIcon, KeyRound } from "lucide-react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useAuth } from "../context/authContext";

export default function LoginPage() {
  const { loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Modos de pantalla: 'login' | 'register' | 'forgot'
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register" | "forgot">(initialMode);

  // Estados del formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (user) {
    navigate("/");
  }

  // Handle Login con Email y Contraseña
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate(-1);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Correo o contraseña incorrectos.");
      } else {
        setError("Error al iniciar sesión. Inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Registro con Email y Contraseña
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate(-1);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("Este correo electrónico ya está registrado.");
      } else if (err.code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setError("Error al registrar la cuenta.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Recuperación de Contraseña
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Se ha enviado un correo con instrucciones para restablecer tu contraseña.");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setError("No existe una cuenta registrada con este correo.");
      } else {
        setError("No se pudo enviar el correo de recuperación.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await loginWithGoogle();
      navigate(-1);
    } catch (err: any) {
      console.error(err);
      setError("Error al iniciar sesión con Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D111C] text-white flex flex-col justify-center items-center px-4 relative">
      {/* Botón de volver */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>Volver al inicio</span>
      </button>

      <div className="w-full max-w-md bg-[#12131A] border border-slate-800 rounded-2xl p-8 shadow-2xl">
        {/* LOGO */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="flex flex-col leading-none text-center">
            <span
              className="text-2xl font-black text-white uppercase"
              style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: "0.18em" }}
            >
              RECAP
            </span>
            <span
              className="text-xs font-semibold text-red-500 uppercase"
              style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: "0.22em" }}
            >
              DANCE
            </span>
          </div>
        </div>

        {/* TÍTULO SEGÚN EL MODO */}
        <div className="text-center mb-6">
          <h1
            className="text-2xl font-black uppercase tracking-wide text-white"
            style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
          >
            {mode === "login" && "Iniciar Sesión"}
            {mode === "register" && "Crear Cuenta"}
            {mode === "forgot" && "Recuperar Contraseña"}
          </h1>
        </div>

        {/* MENSAJES DE ERROR O ÉXITO */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs text-center">
            {message}
          </div>
        )}

        {/* VISTA 1: INICIAR SESIÓN / REGISTRO */}
        {(mode === "login" || mode === "register") && (
          <>
            {/* BOTÓN GOOGLE */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 px-4 rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.98] disabled:opacity-50 mb-4"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span className="text-xs font-semibold">Continuar con Google</span>
            </button>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="px-3 text-[11px] text-slate-500 uppercase tracking-widest font-semibold">O con correo</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* FORMULARIO */}
            <form onSubmit={mode === "login" ? handleEmailLogin : handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-slate-500" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full bg-[#0D111C] border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-slate-500" size={16} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0D111C] border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              </div>

              {mode === "login" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(null); setMessage(null); }}
                    className="text-[11px] text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider shadow-lg shadow-red-600/20 active:scale-[0.98] disabled:opacity-50 mt-2"
              >
                {loading ? "Cargando..." : mode === "login" ? "Iniciar Sesión" : "Registrarse"}
              </button>
            </form>

            {/* SWITCH ENTRE LOGIN Y REGISTRO */}
            <div className="mt-6 text-center text-xs text-slate-400">
              {mode === "login" ? (
                <p>
                  ¿No tienes una cuenta?{" "}
                  <button
                    onClick={() => { setMode("register"); setError(null); }}
                    className="text-red-400 hover:underline font-semibold cursor-pointer"
                  >
                    Regístrate
                  </button>
                </p>
              ) : (
                <p>
                  ¿Ya tienes una cuenta?{" "}
                  <button
                    onClick={() => { setMode("login"); setError(null); }}
                    className="text-red-400 hover:underline font-semibold cursor-pointer"
                  >
                    Inicia sesión
                  </button>
                </p>
              )}
            </div>
          </>
        )}

        {/* VISTA 2: RECUPERAR CONTRASEÑA */}
        {mode === "forgot" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-xs text-slate-400 text-center mb-4">
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-slate-500" size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full bg-[#0D111C] border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider shadow-lg shadow-red-600/20 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar enlace de recuperación"}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); setMessage(null); }}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Volver al inicio de sesión
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}