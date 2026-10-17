import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Home } from './views/home'; 
import EventPage from './views/eventPage'; 
import { Checkout } from './views/checkout';
import { CartProvider } from './context/cartContext';
import PackagesPage from './views/packagePage';
import AdminAddParticipantPage from './views/adminaddparticipantpage'; // <-- 1. Importar componente
import LoginPage from './views/loginPage';
import Navbar from './components/navbar';
import { AuthProvider } from './context/authContext';
import CartPage from "./views/cartPage";
import { PaymentResult } from './views/paymentResult';
import MediaSelectionPage from './views/mediaSelectionPage';
import AdminMediaPage from './views/adminMediaPage';
import MisComprasPage from './views/misComprasPage';
import MisArchivosPage from './views/misArchivosPage';

function AppRoutes() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col justify-between selection:bg-red-500 selection:text-white">
      <main className="flex-grow">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* 1. Ruta Principal */}
          <Route path="/" element={<Home />} />
          
          {/* 2. Ruta Dinámica para Detalle del Evento 
          <Route path="/evento/:eventId" element={<EventPage />} />*/}

          <Route path="/:eventSlug" element={<EventPage />} />

          {/* 3. Ruta para ver los paquetes del participante */}
          <Route path="/:eventSlug/participante/:participantId" element={<PackagesPage />} />

          {/* 4. RUTA ADMIN: Formulario para ingresar participantes */}
          <Route path="/evento/:eventId/admin/participantes" element={<AdminAddParticipantPage />} />
          {/* 4. RUTA ADMIN: Formulario para ingresar multimedia */}
          <Route path="/admin/multimedia" element={<AdminMediaPage />}/>

          <Route path="/eventos/:eventId/participantes/:participantId/seleccionar-material" element={<MediaSelectionPage />} />

          <Route path="/mis-compras/:pedidoItemId/seleccionar-material" element={<MediaSelectionPage />} />

          {/* ⚠️ RUTA OBLIGATORIA: Previene que te devuelva al inicio */}
            <Route path="/carrito" element={<CartPage />} />

          {/* 5. Proceso de Pago / Checkout */}
          <Route 
            path="/checkout" 
            element={<Checkout onBackToCatalog={() => navigate('/')} />} 
          />

          {/*MIS COMPRAS */}
          <Route path="/mis-compras" element={<MisComprasPage />}/>

          <Route path="/mis-compras/:pedidoItemId/archivos" element={<MisArchivosPage />}/>

          <Route path="/pago/resultado" element={<PaymentResult />}/>
          
          {/* 6. Redirección si la ruta no existe */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="bg-black/60 border-t border-slate-800/80 p-4 text-center text-xs text-slate-400 font-medium">
        &copy; {new Date().getFullYear()} RECAP DANCE. Todos los derechos reservados.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
      <BrowserRouter>
      <Navbar />
        <AppRoutes />
      </BrowserRouter>
    </CartProvider>
    </AuthProvider>
    
  );
}