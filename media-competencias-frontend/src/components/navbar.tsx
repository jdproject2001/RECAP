// src/components/Navbar.tsx
import { Link, useNavigate } from "react-router-dom";
import { LogOut, ShoppingCart } from "lucide-react";
import { useAuth } from "../context/authContext";
import { useCart } from "../context/cartContext";

export default function Navbar() {
  const { user, dbUser, logout } = useAuth();
  const navigate = useNavigate();
  const { cart } = useCart(); // Accedemos al estado global del carrito

  // Cantidad total de elementos en el carrito
  const cartItemCount = cart.length;

  return (
    <nav className="border-b border-slate-800/60 bg-[#0D111C]/80 backdrop-blur-md sticky top-0 z-50 transition-all">
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* LOGO RECAP DANCE */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="flex flex-col leading-none">
            <span
              className="text-lg font-black text-white uppercase"
              style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '0.18em' }}
            >
              RECAP
            </span>
            <span
              className="text-[10px] font-semibold text-red-500 uppercase"
              style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '0.22em' }}
            >
              DANCE
            </span>
          </div>
        </div>

        {/* ACCIONES, ENLACES Y CARRITO (Dentro del contenedor principal) */}
        <div className="flex items-center gap-6">
          
          {/* ENLACES DE NAVEGACIÓN */}
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
            <Link to="/" className="text-white hover:text-red-400 transition-colors">Inicio</Link>
            <a href="/#eventos" className="hover:text-red-400 transition-colors">Eventos</a>
            <a href="/#quienes-somos" className="hover:text-red-400 transition-colors">Quiénes Somos</a>
          </div>

          {/* BOTÓN DEL CARRITO */}
          <button
            onClick={() => navigate('/carrito')}
            className="relative p-2.5 bg-[#12131A] hover:bg-slate-800 border border-slate-800 rounded-xl transition-all cursor-pointer text-slate-300 hover:text-white flex items-center justify-center"
            title="Ver carrito"
          >
            <ShoppingCart size={20} />
            
            {/* BADGE CON NÚMERO DE ARTÍCULOS */}
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0D111C] shadow-md animate-in zoom-in-50">
                {cartItemCount}
              </span>
            )}
          </button>

          {/* BOTONES DE AUTENTICACIÓN / USUARIO */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 bg-[#12131A] border border-slate-800 px-3 py-1.5 rounded-xl">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full border border-red-500" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-xs">
                    {dbUser?.nombre?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <span className="text-sm text-slate-200 font-medium hidden sm:inline">
                  {dbUser?.nombre || user.displayName || user.email?.split('@')[0]}
                </span>
                <button
                  onClick={() => logout()}
                  title="Cerrar sesión"
                  className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer font-medium"
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => navigate('/login?mode=register')}
                  className="text-sm px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-colors font-semibold shadow-md shadow-red-600/10 cursor-pointer"
                >
                  Crear cuenta
                </button>
              </>
            )}
          </div>

        </div>

      </div>
    </nav>
  );
}