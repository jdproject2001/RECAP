import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const PaymentResult: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const pedidoId = searchParams.get('pedidoId');
  const status = searchParams.get('status');

  const pagoAprobado = status === 'aprobado';
  const pagoFallido = status === 'fallido';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 max-w-md w-full p-8 text-center">

        {pagoAprobado && (
          <>
            <div className="text-6xl mb-4">
              ✅
            </div>

            <h1 className="text-2xl font-black text-slate-900 mb-2">
              ¡Pago procesado!
            </h1>

            <p className="text-slate-500 text-sm mb-6">
              Tu pago fue procesado correctamente.
            </p>

            {pedidoId && (
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <p className="text-xs text-slate-500 uppercase font-bold">
                  Número de pedido
                </p>

                <p className="text-xl font-black text-indigo-600 mt-1">
                  #{pedidoId}
                </p>
              </div>
            )}

            <p className="text-sm text-slate-600 mb-6">
              Hemos recibido tu compra. Tus archivos multimedia serán
              procesados y estarán disponibles cuando corresponda.
            </p>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Volver al inicio
            </button>
          </>
        )}

        {pagoFallido && (
          <>
            <div className="text-6xl mb-4">
              ❌
            </div>

            <h1 className="text-2xl font-black text-slate-900 mb-2">
              Pago no procesado
            </h1>

            <p className="text-slate-500 text-sm mb-6">
              El pago no pudo completarse.
            </p>

            {pedidoId && (
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <p className="text-xs text-slate-500 uppercase font-bold">
                  Número de pedido
                </p>

                <p className="text-xl font-black text-indigo-600 mt-1">
                  #{pedidoId}
                </p>
              </div>
            )}

            <button
              onClick={() => navigate('/')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Volver al inicio
            </button>
          </>
        )}

        {!pagoAprobado && !pagoFallido && (
          <>
            <div className="text-6xl mb-4">
              ⚠️
            </div>

            <h1 className="text-2xl font-black text-slate-900 mb-2">
              Estado de pago desconocido
            </h1>

            <p className="text-slate-500 text-sm mb-6">
              No pudimos determinar el resultado de tu pago.
            </p>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Volver al inicio
            </button>
          </>
        )}

      </div>
    </div>
  );
};