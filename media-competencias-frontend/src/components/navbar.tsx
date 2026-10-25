
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogOut, ShoppingCart, Menu, X, Home, CalendarDays, Users, ShoppingBag } from "lucide-react";
import { useAuth } from "../context/authContext";
import { useCart } from "../context/cartContext";

export default function Navbar() {
  const { user, dbUser, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const cartItemCount = cart.length;
  // Cierra el menú al navegar
  const irA = (ruta: string) => {
    setMenuOpen(false);
    navigate(ruta);
  };

  const cerrarSesion = async () => {
    setMenuOpen(false);
    await logout();
  };

  const navLinks = [
    { nombre: "Inicio", ruta: "/", icono: Home },
    { nombre: "Eventos", ruta: "/#eventos", icono: CalendarDays },
    { nombre: "Quiénes Somos", ruta: "/#quienes-somos", icono: Users },
    ...(user
      ? [{ nombre: "Mis compras", ruta: "/mis-compras", icono: ShoppingBag }]
      : [])
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#0D111C]/95 backdrop-blur-md">
      {/* NAVBAR PRINCIPAL */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
        {/* LOGO */}
        <Link to="/" onClick={() => setMenuOpen(false)}  className="flex items-center gap-2 sm:gap-3 shrink-0 group">
          <img src="/favicon.png" alt="" className="w-9 h-9 sm:w-12 sm:h-12 object-contain transition-transform duration-300 group-hover:scale-105"/>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-black text-white uppercase" style={{
                fontFamily: '"Barlow Condensed", sans-serif',
                letterSpacing: "0.18em"
              }}
            >
              RECAP
            </span>

            <span className="text-[10px] font-semibold text-red-500 uppercase" style={{
                fontFamily: '"Barlow Condensed", sans-serif',
                letterSpacing: "0.22em"
              }}
            >
              DANCE
            </span>
          </div>
        </Link>

        {/* NAVEGACIÓN DESKTOP */}
        <div className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-400">
          <Link to="/" className="text-white hover:text-red-400 transition-colors">Inicio</Link>
          <a href="/#eventos" className="hover:text-red-400 transition-colors">Eventos</a>
          <a href="/#quienes-somos" className="hover:text-red-400 transition-colors">Quiénes Somos</a>
          {user && (
            <Link to="/mis-compras" className="hover:text-red-400 transition-colors">Mis compras</Link>
          )}
        </div>
        {/* ACCIONES DERECHA */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* CARRITO */}
          <button
            onClick={() => irA("/carrito")}
            className="relative p-2.5 bg-[#12131A] hover:bg-slate-800 border border-slate-800 rounded-xl transition-all cursor-pointer text-slate-300 hover:text-white"
            title="Ver carrito"
            aria-label="Ver carrito"
          >
            <ShoppingCart size={20} />
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0D111C]">
                {cartItemCount}
              </span>
            )}
          </button>

          {/* AUTENTICACIÓN DESKTOP */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 bg-[#12131A] border border-slate-800 px-3 py-1.5 rounded-xl">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className="w-7 h-7 rounded-full border border-red-500"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-xs">
                    {dbUser?.nombre?.[0] ||
                      user.email?.[0]?.toUpperCase() ||
                      "U"}
                  </div>
                )}

                <span className="text-sm text-slate-200 font-medium max-w-28 truncate">
                  {dbUser?.nombre ||
                    user.displayName ||
                    user.email?.split("@")[0]}
                </span>

                <button
                  onClick={cerrarSesion}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                >
                  <LogOut size={16} />
                </button>

              </div>
            ) : (
              <>
                <button
                  onClick={() => irA("/login")}
                  className="text-sm px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer font-medium"
                >
                  Iniciar sesión
                </button>

                <button
                  onClick={() => irA("/login?mode=register")}
                  className="text-sm px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-colors font-semibold cursor-pointer"
                >
                  Crear cuenta
                </button>
              </>
            )}
          </div>

          {/* BOTÓN MENÚ MÓVIL */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2.5 rounded-xl border border-slate-800 bg-[#12131A] text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="recap-mobile-menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* MENÚ DESPLEGABLE MÓVIL */}
      {menuOpen && (
        <div
          id="recap-mobile-menu"
          className="lg:hidden absolute top-full left-0 right-0 bg-[#0D111C] border-b border-slate-800 shadow-2xl max-h-[calc(100dvh-5rem)] overflow-y-auto"
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            {navLinks.map(({ nombre, ruta, icono: Icon }) => (
              <button
                key={ruta}
                type="button"
                onClick={() => {
                  if (ruta.includes("#")) {
                    setMenuOpen(false);
                    window.location.assign(ruta);
                  } else {
                    irA(ruta);
                  }
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors text-left cursor-pointer ${
                  location.pathname === ruta
                    ? "bg-red-600/10 text-red-400"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Icon size={19} />
                {nombre}
              </button>
            ))}

            {/* SEPARADOR */}
            <div className="border-t border-slate-800 my-3" />

            {/* USUARIO MÓVIL */}
            {user ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      className="w-9 h-9 rounded-full border border-red-500"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center font-bold text-white">
                      {dbUser?.nombre?.[0] ||
                        user.email?.[0]?.toUpperCase() ||
                        "U"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {dbUser?.nombre ||
                        user.displayName ||
                        "Mi cuenta"}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-600/10 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut size={19} />
                  Cerrar sesión
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  onClick={() => irA("/login")}
                  className="px-3 py-3 border border-slate-700 rounded-xl text-sm font-semibold text-slate-200 cursor-pointer"
                >
                  Iniciar sesión
                </button>

                <button
                  onClick={() => irA("/login?mode=register")}
                  className="px-3 py-3 bg-red-600 rounded-xl text-sm font-semibold text-white cursor-pointer"
                >
                  Crear cuenta
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
