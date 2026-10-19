import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../firebase/firebase';
import { API_BASE } from '../config/api';
import { useCart } from '../context/cartContext';

export const PaymentResult: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [estadoPago, setEstadoPago] = useState<string | null>(null);
  const [pedidoId, setPedidoId] =  useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmadoRef =  useRef(false);
  const { clearCart } = useCart();
  
  useEffect(() => {
    if (confirmadoRef.current) {
      return;
    }

    confirmadoRef.current = true;
    const confirmarPago = async () => {
      try {
        // =========================================
        // DATOS QUE PAYPHONE ENVÍA EN LA URL
        // =========================================
        const id = searchParams.get('id');
        const clientTransactionId = searchParams.get('clientTransactionId');
        if (!id || !clientTransactionId) {
          throw new Error(
            'Payphone no devolvió los datos necesarios para confirmar la transacción.'
          );
        }

        // =========================================
        // USUARIO AUTENTICADO
        // =========================================
        const user = auth.currentUser;

        if (!user) {
          throw new Error('Debes iniciar sesión para confirmar el pago.');
        }

        const token = await user.getIdToken();

        // =========================================
        // CONFIRMAR CON NUESTRO BACKEND
        // =========================================
        const response = await fetch(`${API_BASE}/payments/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            id: Number(id),
            clientTransactionId
          })
        });

        const text = await response.text();
        let data;

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            'El backend devolvió una respuesta inválida al confirmar el pago.'
          );
        }

        if (!response.ok) {
          throw new Error(data.error || 'No se pudo confirmar el pago.');
        }

        // =========================================
        // GUARDAR RESULTADO
        // =========================================
        setEstadoPago(data.estadoPago);
        setPedidoId(data.pedidoId);

        // =========================================
        // REDIRECCIÓN AUTOMÁTICA SI FUE APROBADO
        // =========================================
        if (data.estadoPago === 'aprobado') {
          clearCart();
          navigate('/mis-compras', { replace: true });
          return;
        }
      } catch (err) {
        console.error('Error confirmando pago:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Ocurrió un error confirmando el pago.'
        );
      } finally {
        setLoading(false);
      }
    };

    confirmarPago();

  }, [searchParams, navigate]);

  // =========================================
  // LOADING
  // =========================================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 max-w-md w-full p-8 text-center">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-black text-slate-900 mb-2">
            Confirmando tu pago
          </h1>
          <p className="text-sm text-slate-500">
            Estamos verificando la transacción con Payphone.
          </p>
        </div>
      </div>
    );
  }

  // =========================================
  // ERROR
  // =========================================
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 max-w-md w-full p-8 text-center">
          <div className="text-6xl mb-4">
            ⚠️
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">
            No pudimos confirmar el pago
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            {error}
          </p>
          <button
            onClick={() =>
              navigate('/')
            }
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // =========================================
  // ESTADOS
  // =========================================
  const pagoAprobado =
    estadoPago === 'aprobado';
  const pagoRechazado =
    estadoPago === 'rechazado';
  const pagoPendiente =
    estadoPago === 'pendiente';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 max-w-md w-full p-8 text-center">
        {pagoAprobado && (
          <>
            <div className="text-6xl mb-4">
              ✅
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">
              ¡Pago aprobado!
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              Tu pago fue confirmado correctamente con Payphone.
            </p>

            {pedidoId && (
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <p className="text-xs text-slate-500 uppercase font-bold">
                  Número de pedido
                </p>
                <p className="text-sm font-black text-indigo-600 mt-1 break-all">
                  {pedidoId}
                </p>
              </div>
            )}

            <button
              onClick={() =>
                navigate('/')
              }
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Volver al inicio
            </button>
          </>
        )}

        {pagoRechazado && (
          <>
            <div className="text-6xl mb-4">
              ❌
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">
              Pago rechazado
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              Payphone indicó que la transacción fue rechazada o cancelada.
            </p>
            <button
              onClick={() =>
                navigate('/')
              }
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Volver al inicio
            </button>
          </>
        )}

        {pagoPendiente && (
          <>
            <div className="text-6xl mb-4">
              ⏳
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">
              Pago pendiente
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              Payphone todavía no ha confirmado definitivamente la transacción.
            </p>
            <button
              onClick={() =>
                window.location.reload()
              }
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors mb-3"
            >
              Verificar nuevamente
            </button>
            <button
              onClick={() =>
                navigate('/mis-compras')
              }
              className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition-colors"
            >
              Ver mis compras
            </button>
          </>
        )}

        {!pagoAprobado &&
          !pagoRechazado &&
          !pagoPendiente && (
            <>
              <div className="text-6xl mb-4">
                ⚠️
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">
                Estado desconocido
              </h1>
              <p className="text-slate-500 text-sm mb-6">
                No pudimos determinar el estado final del pago.
              </p>
            </>
          )}
      </div>
    </div>
  );
};