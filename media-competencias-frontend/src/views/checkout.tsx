import React, { useState } from 'react';
import { useCart } from '../context/cartContext';

export const Checkout: React.FC<{ onBackToCatalog: () => void }> = ({ onBackToCatalog }) => {
  const { cart, getCartTotal, clearCart } = useCart();
  
  // Estados para el formulario de contacto
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'http://localhost:4000/api/v1';

  const handleProcesarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // PASO 1: Crear el Pedido en el Backend
      const orderPayload = {
        nombre,
        email,
        whatsapp,
        items: cart.map(item => ({
          paquete_id: item.paquete.id,
          participante_id: item.participante.id
        }))
      };

      const orderResponse = await fetch(`${API_BASE}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Error al crear el pedido.');
      }

      const pedidoId = orderData.pedido.id;

      // PASO 2: Iniciar la sesión de pago (Mock Gateway o Placetopay)
      const paymentResponse = await fetch(`${API_BASE}/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId })
      });

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok) {
        throw new Error(paymentData.error || 'Error al inicializar la pasarela.');
      }

      // Vaciar el carrito localmente antes de salir
      clearCart();

      // PASO 3: Redirección final del usuario hacia el checkout (Simulado o Real)
      window.location.href = paymentData.processUrl;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h2 className="text-xl font-bold text-slate-800">Tu carrito está vacío</h2>
        <p className="text-slate-500 mb-6 text-sm">Regresa al catálogo para seleccionar tus videos y fotos de carrera.</p>
        <button onClick={onBackToCatalog} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg cursor-pointer transition-colors">
          Ver Catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Columna Izquierda: Resumen del Carrito */}
        <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <div>
            <button onClick={onBackToCatalog} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 mb-6 block cursor-pointer">
              ← Volver al catálogo
            </button>
            <h2 className="text-xl font-black tracking-tight text-slate-900 mb-4">Resumen de tu Compra</h2>
            
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-2">
              {cart.map((item) => (
                <div key={item.idUnique} className="py-3 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-bold text-slate-800">{item.paquete.nombre_paquete}</p>
                    <p className="text-xs text-indigo-600 font-medium">👤 Atleta: {item.participante.nombre_completo} (#{item.participante.dorsal_numero})</p>
                  </div>
                  <p className="font-bold text-slate-900">${parseFloat(item.paquete.precio).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-6">
            <div className="flex justify-between items-center text-lg font-black text-slate-900">
              <span>Total a pagar:</span>
              <span className="text-2xl text-indigo-600">${getCartTotal().toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Formulario de Checkout */}
        <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-100">
          <h2 className="text-xl font-black tracking-tight text-slate-900 mb-2">Datos de Entrega</h2>
          <p className="text-xs text-slate-500 mb-6">Completa tus datos reales. Los archivos multimedia digitales se despacharán usando esta información tras el evento.</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-bold mb-4">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleProcesarPago} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nombre Completo del Comprador:</label>
              <input
                type="text"
                required
                placeholder="Ej: Danna Sanchez"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Correo Electrónico:</label>
              <input
                type="email"
                required
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Número de WhatsApp (con código de país):</label>
              <input
                type="tel"
                required
                placeholder="Ej: +593987654321"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-bold py-4 px-4 rounded-xl shadow-xs mt-6 transition-colors text-sm cursor-pointer ${
                loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {loading ? 'Procesando con la pasarela...' : `Pagar $${getCartTotal().toFixed(2)} Seguro`}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};