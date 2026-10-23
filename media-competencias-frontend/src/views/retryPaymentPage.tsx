import {
  useEffect,
  useRef,
  useState
} from 'react';
import {
  useNavigate,
  useParams
} from 'react-router-dom';
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

export default function RetryPaymentPage() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payphoneConfig, setPayphoneConfig] = useState<PayphoneConfig | null>(null);
  const [paymentBoxError, setPaymentBoxError] = useState<string | null>(null);
  const [payphoneAssetsReady, setPayphoneAssetsReady] = useState(false);

  const payphoneRendered = useRef(false);
  const paymentInitiatedRef = useRef(false);

  useEffect(() => {
    let active = true;
    const cssUrl = 'https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css';
    const jsUrl = 'https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js';

    let link = document.getElementById('recap-payphone-css') as HTMLLinkElement | null;
    let createdLink = false;

    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      link.id = 'recap-payphone-css';
      document.head.appendChild(link);
      createdLink = true;
    }

    const loadStyles = new Promise<void>((resolve, reject) => {
      if (link?.sheet) {
        resolve();
        return;
      }
      link!.onload = () => {
        resolve();
      };
      link!.onerror = () => {
        reject(new Error('No se pudo cargar el CSS de PayPhone.'));
      };
    });

    const loadScript = new Promise<void>((resolve, reject) => {
      if ((window as any).PPaymentButtonBox) {
        resolve();
        return;
      }

      let script = document.getElementById('recap-payphone-js') as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement('script');
        script.id = 'recap-payphone-js';
        script.type = 'module';
        script.src = jsUrl;
      }

      if (script.dataset.loaded === 'true') {
        resolve();
        return;
      }

      const onLoad = () => {
        script!.dataset.loaded = 'true';
        console.log('✅ Script Payphone cargado');
        console.log('PPaymentButtonBox:', (window as any).PPaymentButtonBox);
        resolve();
      };

      const onError = () => {
        script!.dataset.loaded = 'error';
        reject(new Error('No se pudo cargar PayPhone.'));
      };

      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });

      if (!script.isConnected) {
        document.body.appendChild(script);
      }
    });

    Promise.all([
      loadStyles,
      loadScript
    ])
      .then(() => {
        if (!active) {
          return;
        }
        console.log('✅ Recursos Payphone listos');
        setPayphoneAssetsReady(true);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        console.error('❌ Error cargando Payphone:', err);
        setPaymentBoxError('No se pudieron cargar los recursos de Payphone.');
      });

    return () => {
      active = false;
      if (createdLink) {
        link?.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (paymentInitiatedRef.current) {
      return;
    }
    paymentInitiatedRef.current = true;

    const prepararPago = async () => {
      if (!pedidoId) {
        setError('No se encontró el pedido.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setPaymentBoxError(null);

        const user = auth.currentUser;
        if (!user) {
          throw new Error('Debes iniciar sesión.');
        }

        const token = await user.getIdToken();
        console.log('🔵 Reintentando pedido:', pedidoId);

        const response = await fetch(`${API_BASE}/payments/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            pedidoId
          })
        });

        const responseText = await response.text();
        let data;

        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`El backend devolvió una respuesta no válida. Status: ${response.status}`);
        }

        console.log('🔵 Respuesta initiate:', data);

        if (!response.ok) {
          throw new Error(data.error || 'No se pudo preparar el pago.');
        }

        if (!data.clientTransactionId || !data.token || !data.storeId) {
          throw new Error('La configuración devuelta por Payphone está incompleta.');
        }

        setPayphoneConfig({
          pedidoId: data.pedidoId,
          clientTransactionId: data.clientTransactionId,
          amount: Number(data.amount),
          amountWithoutTax: Number(data.amountWithoutTax),
          amountWithTax: Number(data.amountWithTax || 0),
          tax: Number(data.tax || 0),
          currency: data.currency || 'USD',
          storeId: data.storeId,
          reference: data.reference,
          token: data.token,
          email: data.email,
          phoneNumber: data.phoneNumber
        });
      } catch (err) {
        console.error('❌ Error preparando reintento:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Error preparando el pago.'
        );
      } finally {
        setLoading(false);
      }
    };

    prepararPago();
  }, [pedidoId]);

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
        if (attempts >= maxAttempts) {
          console.error('❌ PPaymentButtonBox nunca cargó');
          setPaymentBoxError(
            'No se pudo cargar Payphone. Recarga la página e inténtalo nuevamente.'
          );
          return true;
        }
        return false;
      }

      const container = document.getElementById('pp-button');
      if (!container) {
        return false;
      }

      try {
        container.innerHTML = '';
        console.log('🟢 Renderizando Payphone...');

        new PayphoneBox({
          token: payphoneConfig.token,
          clientTransactionId: payphoneConfig.clientTransactionId,
          amount: payphoneConfig.amount,
          amountWithoutTax: payphoneConfig.amountWithoutTax,
          amountWithTax: payphoneConfig.amountWithTax,
          tax: payphoneConfig.tax,
          service: 0,
          tip: 0,
          currency: payphoneConfig.currency || 'USD',
          storeId: payphoneConfig.storeId,
          reference: payphoneConfig.reference,
          lang: 'es',
          defaultMethod: 'card',
          timeZone: -5,
          email: payphoneConfig.email || auth.currentUser?.email || '',
          phoneNumber: payphoneConfig.phoneNumber || ''
        }).render('pp-button');

        payphoneRendered.current = true;
        console.log('✅ Payphone renderizado correctamente');
        return true;
      } catch (err) {
        console.error('❌ Error renderizando Cajita Payphone:', err);
        setPaymentBoxError(
          'Ocurrió un error al cargar la pasarela de pago.'
        );
        return true;
      }
    };

    if (renderPayphoneBox()) {
      return;
    }

    const interval = window.setInterval(() => {
      if (renderPayphoneBox()) {
        window.clearInterval(interval);
      }
    }, 300);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    payphoneConfig,
    payphoneAssetsReady
  ]);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white p-6">
      <div className="max-w-xl mx-auto">
        <button
          type="button"
          onClick={() =>
            navigate('/mis-compras')
          }
          className="text-slate-400 hover:text-white mb-6 cursor-pointer transition-colors"
        >
          ← Volver a mis compras
        </button>

        <div className="bg-[#121722] border border-slate-800 rounded-2xl p-6">
          <p className="text-red-500 text-xs font-bold uppercase tracking-widest">
            Pago pendiente
          </p>

          <h1 className="text-2xl font-black mt-2 mb-6">
            Reintentar pago
          </h1>

          {loading && (
            <div className="py-8 text-center">
              <div className="w-8 h-8 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400">
                Preparando Payphone...
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-4 text-sm">
              ⚠️ {error}
            </div>
          )}

          {paymentBoxError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-4 text-sm">
              ⚠️ {paymentBoxError}
            </div>
          )}

          {!loading &&
            payphoneConfig &&
            payphoneAssetsReady && (
              <>
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 mb-5 text-xs font-bold">
                  ✓ Pago listo para reintentar
                </div>

                <div
                  id="pp-button"
                  className="w-full min-h-[120px]"
                />

                <p className="text-[11px] text-slate-500 text-center mt-4">
                  El pago es procesado de forma segura por Payphone.
                </p>
              </>
            )}
        </div>
      </div>
    </div>
  );
}