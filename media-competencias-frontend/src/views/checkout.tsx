import React, { useEffect, useRef, useState } from 'react';
import { useCart } from '../context/cartContext';
import { API_BASE } from '../config/api';
import { auth } from '../firebase/firebase';

interface PayphoneConfig {
  pedidoId: string;
  clientTransactionId: string;
  amount: number;
  amountWithoutTax: number;
  amountWithTax: number;
  tax: number;
  currency: string;
  storeId: string;
  reference: string;
  token: string;
  email?: string;
  phoneNumber?: string;
}

export const Checkout: React.FC<{
  onBackToCatalog: () => void;
}> = ({ onBackToCatalog }) => {
  const { cart, getCartTotal } = useCart();

  // =====================================================
  // ESTADOS
  // =====================================================
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payphoneConfig, setPayphoneConfig] = useState<PayphoneConfig | null>(null);
  const [paymentBoxError, setPaymentBoxError] = useState<string | null>(null);
  const [payphoneAssetsReady, setPayphoneAssetsReady] = useState(false);
  const [codigoDescuento, setCodigoDescuento] = useState('');
  const [validandoDescuento, setValidandoDescuento] = useState(false);
  const [descuentoError, setDescuentoError] = useState<string | null>(null);
  const [descuentoAplicado, setDescuentoAplicado] = useState<{
    codigo: string;
    tipo: string;
    valor: number;
    subtotal: number;
    descuento: number;
    total: number;
  } | null>(null);
  // =====================================================
  // REFS DE CONTROL
  // =====================================================
  /*
   * Evita renderizar dos veces Payphone.
   */
  const payphoneRendered = useRef(false);

  /*
   * Si el pedido ya fue creado pero falla /payments/initiate, podemos reintentar sin crear otro pedido.
   */
  const pedidoCreadoRef = useRef<string | null>(null);

  /* =========================================
 CARGAR RECURSOS PAYPHONE EN CHECKOUT
========================================= */
  useEffect(() => {
    let active = true;

    const cssUrl = "https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css";
    const jsUrl = "https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js";

    // Cargar estilos únicamente en Checkout
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    link.id = "recap-payphone-css";

    document.head.appendChild(link);

    const loadStyles = new Promise<void>((resolve, reject) => {
      link.onload = () => resolve();
      link.onerror = () => reject(new Error("No se pudo cargar el CSS de PayPhone."));
    });

    // Cargar JavaScript una sola vez
    const loadScript = new Promise<void>((resolve, reject) => {
      if ((window as any).PPaymentButtonBox) {
        resolve();
        return;
      }

      let script = document.getElementById("recap-payphone-js") as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement("script");
        script.id = "recap-payphone-js";
        script.type = "module";
        script.src = jsUrl;
      }

      if (script.dataset.loaded === "true") {
        resolve();
        return;
      }

      const onLoad = () => {
        script!.dataset.loaded = "true";
        resolve();
      };

      const onError = () => {
        script!.dataset.loaded = "error";
        reject(new Error("No se pudo cargar PayPhone."));
      };

      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });

      if (!script.isConnected) {
        document.body.appendChild(script);
      }
    });

    Promise.all([loadStyles, loadScript])
      .then(() => {
        if (active) {
          setPayphoneAssetsReady(true);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Error cargando PayPhone:", err);
          setPaymentBoxError("No se pudieron cargar los recursos de PayPhone.");
        }
      });

    return () => {
      active = false;
      link.remove();
    };
  }, []);

  const aplicarDescuento = async () => {
    if (!codigoDescuento.trim()) {
      setDescuentoError('Ingresa un código de descuento.');
      return;
    }

    setValidandoDescuento(true);
    setDescuentoError(null);

    try {
      const response = await fetch(`${API_BASE}/descuentos/validar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          codigo: codigoDescuento.trim(),
          items: cart.map(item => ({
            paquete_id: item.paquete.id,
            participante_id: item.participante.id
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'El código de descuento no es válido.'
        );
      }

      setDescuentoAplicado({
        codigo: data.codigo,
        tipo: data.tipo,
        valor: Number(data.valor),
        subtotal: Number(data.subtotal),
        descuento: Number(data.descuento),
        total: Number(data.total)
      });

      setCodigoDescuento(data.codigo);
    } catch (err) {
      setDescuentoAplicado(null);
      setDescuentoError(
        err instanceof Error
          ? err.message
          : 'No se pudo validar el código.'
      );
    } finally {
      setValidandoDescuento(false);
    }
  };
  // =====================================================
  // CREAR PEDIDO + PREPARAR PAYPHONE
  // =====================================================
  const prepararCheckout = async () => {
    if (cart.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPaymentBoxError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Debes iniciar sesión para realizar una compra.');
      }

      const token = await user.getIdToken();
      let pedidoId = pedidoCreadoRef.current;

      // =================================================
      // PASO 1:
      // CREAR PEDIDO SOLO SI TODAVÍA NO EXISTE
      // =================================================
      if (!pedidoId) {
        const orderPayload = {
          nombre: user.displayName || '',
          email: user.email || '',
          whatsapp: '',
          codigo_descuento: descuentoAplicado ? descuentoAplicado.codigo : null,
          items:
            cart.map(item => ({
              paquete_id:
                item.paquete.id,
              participante_id:
                item.participante.id,
              tipo_compra:
                item.tipoCompra,
              multimedia_ids:
                item.multimedia_ids
            }))
        };

        const orderResponse =
          await fetch(
            `${API_BASE}/pedidos`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
                Authorization:
                  `Bearer ${token}`
              },
              body:
                JSON.stringify(
                  orderPayload
                )
            }
          );

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
          throw new Error(
            orderData.error ||
            'Error al crear el pedido.'
          );
        }

        pedidoId = orderData.pedido.id;
        pedidoCreadoRef.current = pedidoId;
      }

      // =================================================
      // PASO 2:
      // PREPARAR TRANSACCIÓN PAYPHONE
      // =================================================
      const paymentResponse =
        await fetch(
          `${API_BASE}/payments/initiate`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Authorization:
                `Bearer ${token}`
            },
            body:
              JSON.stringify({
                pedidoId
              })
          }
        );

      const paymentText = await paymentResponse.text();
      let paymentData;

      try {
        paymentData =
          JSON.parse(paymentText);
      } catch {
        throw new Error(
          `El backend de pagos devolvió una respuesta no válida. Status: ${paymentResponse.status}`
        );
      }

      if (!paymentResponse.ok) {
        throw new Error(
          paymentData.error ||
          'Error al preparar la pasarela de pago.'
        );
      }

      if (
        !paymentData.clientTransactionId || !paymentData.token || !paymentData.storeId
      ) {
        throw new Error(
          'La configuración devuelta por Payphone está incompleta.'
        );
      }

      // =================================================
      // PASO 3:
      // GUARDAR CONFIGURACIÓN PAYPHONE
      // =================================================
      setPayphoneConfig({
        pedidoId:
          paymentData.pedidoId,
        clientTransactionId:
          paymentData.clientTransactionId,
        amount:
          Number(
            paymentData.amount
          ),
        amountWithoutTax:
          Number(
            paymentData.amountWithoutTax
          ),
        amountWithTax:
          Number(
            paymentData.amountWithTax || 0
          ),
        tax:
          Number(
            paymentData.tax || 0
          ),
        currency:
          paymentData.currency ||
          'USD',
        storeId:
          paymentData.storeId,
        reference:
          paymentData.reference,
        token:
          paymentData.token,
        email:
          paymentData.email
      });
    } catch (err) {
      console.error('Error procesando pasarela:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error inesperado.'
      );
    } finally {
      setLoading(false);
    }
  };
  // =====================================================
  // RENDERIZAR CAJITA PAYPHONE
  // =====================================================
  useEffect(() => {
    if (
      !payphoneConfig ||
      !payphoneAssetsReady ||
      payphoneRendered.current
    ) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 30;

    const renderPayphoneBox = () => {
      attempts++;

      const PayphoneBox = (window as any).PPaymentButtonBox;
      if (!PayphoneBox) {
        if (
          attempts >=
          maxAttempts
        ) {
          setPaymentBoxError('No se pudo cargar Payphone. Recarga la página e inténtalo nuevamente.');
          return true;
        }
        return false;
      }

      const container = document.getElementById('pp-button');
      if (!container) {
        return false;
      }

      try {
        container.innerHTML =
          '';
        new PayphoneBox({
          token:
            payphoneConfig.token,

          clientTransactionId:
            payphoneConfig.clientTransactionId,

          amount:
            payphoneConfig.amount,

          amountWithoutTax:
            payphoneConfig.amountWithoutTax,

          amountWithTax:
            payphoneConfig.amountWithTax,

          tax:
            payphoneConfig.tax,

          service: 0,
          tip: 0,

          currency:
            payphoneConfig.currency || 'USD',

          storeId:
            payphoneConfig.storeId,

          reference:
            payphoneConfig.reference,

          lang: 'es',

          defaultMethod:
            'card',

          timeZone:
            -5

        }).render('pp-button');

        payphoneRendered.current =
          true;

        return true;
      } catch (err) {
        console.error(
          'Error renderizando Cajita Payphone:',
          err
        );

        setPaymentBoxError(
          'Ocurrió un error al cargar la pasarela de pago.'
        );

        return true;
      }
    };

    if (
      renderPayphoneBox()
    ) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          if (
            renderPayphoneBox()
          ) {
            window.clearInterval(
              interval
            );
          }
        },
        300
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    payphoneConfig,
    payphoneAssetsReady
  ]);
  // =====================================================
  // CARRITO VACÍO
  // =====================================================
  if (
    cart.length === 0 &&
    !payphoneConfig
  ) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 text-center">
        <div className="text-5xl mb-4">
          🛒
        </div>
        <h2 className="text-xl font-bold text-slate-800">Tu carrito está vacío</h2>
        <p className="text-slate-500 mb-6 text-sm">Regresa al catálogo para seleccionar tu material.</p>
        <button
          onClick={
            onBackToCatalog
          }
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg cursor-pointer transition-colors"
        >
          Ver catálogo
        </button>
      </div>
    );
  }

  // =====================================================
  // CHECKOUT
  // =====================================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={
            onBackToCatalog
          }
          className="text-sm font-bold text-indigo-600 hover:text-indigo-800 mb-6 cursor-pointer"
        >
          ← Volver al catálogo
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* ========================================= */}
          {/* RESUMEN */}
          {/* ========================================= */}
          <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 mb-4">Resumen de tu compra</h2>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-2">
                {cart.map(
                  item => (
                    <div
                      key={
                        item.idUnique
                      }
                      className="py-4 flex justify-between gap-4 text-sm"
                    >
                      <div>
                        <p className="font-bold text-slate-800">
                          {
                            item
                              .paquete
                              .nombre_paquete
                          }
                        </p>
                        <p className="text-xs text-indigo-600 font-medium mt-1">
                          👤{' '}
                          {
                            item
                              .participante
                              .nombre_completo
                          }
                          {' '}(#
                          {
                            item
                              .participante
                              .dorsal_numero
                          }
                          )
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {item.tipoCompra ===
                            'RESERVA'
                            ? 'Reserva de material'
                            : `${item.multimedia_ids.length} archivo(s) seleccionado(s)`}
                        </p>
                      </div>

                      <p className="font-bold text-slate-900 whitespace-nowrap">
                        $
                        {Number(
                          item.paquete
                            .precio
                        ).toFixed(2)}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-5 mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Código de descuento
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={codigoDescuento}
                  onChange={(e) => {
                    setCodigoDescuento(
                      e.target.value.toUpperCase()
                    );
                    setDescuentoError(null);
                  }}
                  disabled={
                    !!descuentoAplicado
                  }
                  placeholder="Ingresa tu código"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm uppercase focus:outline-none focus:border-indigo-500 disabled:bg-slate-100"
                />

                {!descuentoAplicado ? (
                  <button
                    type="button"
                    onClick={aplicarDescuento}
                    disabled={
                      validandoDescuento
                    }
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 rounded-lg text-sm font-bold cursor-pointer"
                  >
                    {validandoDescuento
                      ? 'Validando...'
                      : 'Aplicar'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDescuentoAplicado(null);
                      setCodigoDescuento('');
                      setDescuentoError(null);
                    }}
                    className="border border-red-200 text-red-600 hover:bg-red-50 px-4 rounded-lg text-sm font-bold cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {descuentoError && (
                <p className="text-xs text-red-600 font-medium mt-2">
                  {descuentoError}
                </p>
              )}

              {descuentoAplicado && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                  <p className="text-xs font-bold text-green-700">
                    ✓ Código {descuentoAplicado.codigo} aplicado
                  </p>

                  <p className="text-xs text-green-600 mt-1">
                    Ahorras $
                    {descuentoAplicado.descuento.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-5 mt-6">
              {descuentoAplicado && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-500">
                      Subtotal
                    </span>
                    <span className="text-sm font-bold text-slate-700">
                      ${descuentoAplicado.subtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-green-600">
                      Descuento {descuentoAplicado.codigo}
                    </span>
                    <span className="text-sm font-bold text-green-600">
                      -${descuentoAplicado.descuento.toFixed(2)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center">
                <span className="font-black text-slate-900">
                  Total:
                </span>
                <span className="text-2xl font-black text-indigo-600">
                  ${(descuentoAplicado ? descuentoAplicado.total : getCartTotal()).toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          {/* ========================================= */}
          {/* PAYPHONE */}
          {/* ========================================= */}
          <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-100">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">Pago seguro</p>
            <h2 className="text-xl font-black text-slate-900">Completa tu pago</h2>
            <p className="text-xs text-slate-500 mt-2 mb-6">Tu pago será procesado de forma segura mediante Payphone.</p>

            {/* ========================================= */}
            {/* ANTES DE PREPARAR PAYPHONE */}
            {/* ========================================= */}
            {!payphoneConfig && !loading && (
              <div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-bold mb-4">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={prepararCheckout}
                  className="w-full text-white font-bold py-4 px-4 rounded-xl transition-colors text-sm bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                >
                  Continuar al pago ${(descuentoAplicado ? descuentoAplicado.total : getCartTotal()).toFixed(2)}
                </button>
              </div>
            )}

            {/* ========================================= */}
            {/* LOADING */}
            {/* ========================================= */}
            {loading && (
              <div className="py-12 text-center">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="font-bold text-slate-700">Preparando pago...</p>
                <p className="text-xs text-slate-400 mt-2">Estamos creando tu pedido y conectando con Payphone.</p>
              </div>
            )}

            {/* ========================================= */}
            {/* CAJITA */}
            {/* ========================================= */}
            {!loading && payphoneConfig && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-5">
                  <p className="text-xs font-bold text-green-700">✓ Pedido creado correctamente</p>
                </div>

                {paymentBoxError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-bold mb-4">
                    ⚠️ {paymentBoxError}
                  </div>
                )}

                <div id="pp-button" className="w-full min-h-[120px]" />
                <p className="text-[11px] text-slate-400 text-center mt-4">El pago es procesado de forma segura por Payphone.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};