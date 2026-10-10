import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, Image as ImageIcon, Loader2, Video} from 'lucide-react';
import { API_BASE } from '../config/api';
import { auth } from '../firebase/firebase';

interface Evento {
  id: string;
  nombre: string;
  fecha: string;
}

interface Participante {
  id: string;
  nombre_completo: string;
  dorsal_numero: string;
  nombre_categoria: string;
  tipo_categoria: string;
}

interface Paquete {
  id: string;
  nombre_paquete: string;
  tipo: 'foto' | 'video' | 'combo';
  modalidad: string;
  cantidad_fotos: number;
  tipo_formato: string;
  precio: number;
}

interface PedidoItem {
  pedido_item_id: string;
  evento: Evento;
  participante: Participante;
  paquete: Paquete;
  multimedia_seleccionados: number;
  fotos_seleccionadas: number;
  videos_seleccionados: number;
  fotos_disponibles: number;
  videos_disponibles: number;
  estado_material:
    | 'PAGO_PENDIENTE'
    | 'MATERIAL_PENDIENTE'
    | 'DISPONIBLE_PARA_SELECCIONAR'
    | 'MATERIAL_SELECCIONADO';
}

interface Pedido {
  id: string;
  monto_total: string;
  estado_pago: string;
  fecha_creacion: string;
  items: PedidoItem[];
}

export default function MisComprasPage() {
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargarCompras = async () => {
      try {
        setLoading(true);
        setError(null);

        const user = auth.currentUser;

        if (!user) {
          throw new Error('Debes iniciar sesión para ver tus compras.');
        }

        const token = await user.getIdToken();

        const response = await fetch(`${API_BASE}/pedidos/mis-compras`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'No se pudieron cargar tus compras.');
        }

        setPedidos(data.pedidos || []);
      } catch (err) {
        console.error('Error cargando compras:', err);
        setError(
          err instanceof Error ? err.message : 'Ocurrió un error inesperado.'
        );
      } finally {
        setLoading(false);
      }
    };

    cargarCompras();
  }, []);

  const handleSeleccionarMaterial = (item: PedidoItem) => {
    navigate(`/mis-compras/${item.pedido_item_id}/seleccionar-material`, {
      state: {
        pedidoItemId: item.pedido_item_id,
        paquete: {
          id: item.paquete.id,
          nombre_paquete: item.paquete.nombre_paquete,
          descripcion: '',
          precio: Number(item.paquete.precio),
          tipo: item.paquete.tipo,
          cantidad_fotos: Number(item.paquete.cantidad_fotos || 0)
        },
        participante: {
          id: item.participante.id,
          nombre_completo: item.participante.nombre_completo,
          dorsal_numero: item.participante.dorsal_numero
        },
        modo: 'RESERVA'
      }
    });
  };

  const handleVerArchivos = (item: PedidoItem) => {
    navigate(`/mis-compras/${item.pedido_item_id}/archivos`);
  };

  const renderEstado = (item: PedidoItem) => {
    if (item.estado_material === 'PAGO_PENDIENTE') {
      return (
        <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
          <Clock3 size={17} />
          Pago pendiente
        </div>
      );
    }

    if (item.estado_material === 'MATERIAL_PENDIENTE') {
      return (
        <div>
          <div className="flex items-center gap-2 text-slate-300 text-sm font-bold">
            <Clock3 size={17} />
            Material pendiente
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Estamos preparando tu material. Cuando esté disponible podrás seleccionarlo desde aquí.
          </p>
        </div>
      );
    }

    if (item.estado_material === 'DISPONIBLE_PARA_SELECCIONAR') {
      return (
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
            <CheckCircle2 size={17} />
            Material disponible
          </div>
          <button
            type="button"
            onClick={() => handleSeleccionarMaterial(item)}
            className="mt-3 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer"
          >
            Seleccionar material
          </button>
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
          <CheckCircle2 size={17} />
          Material seleccionado
        </div>
        <button
          type="button"
          onClick={() => handleVerArchivos(item)}
          className="mt-3 bg-[#1A1F2E] border border-slate-700 hover:border-slate-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer"
        >
          Ver mis archivos
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D111C] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-red-500 mx-auto mb-4" />
          <p className="text-slate-400">Cargando tus compras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D111C] text-white pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 cursor-pointer"
        >
          <ArrowLeft size={16} />
          Volver
        </button>

        <div className="mb-8">
          <p className="text-red-500 text-xs font-bold uppercase tracking-[0.2em] mb-2">
            Mi cuenta
          </p>
          <h1
            className="text-4xl font-black uppercase"
            style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
          >
            Mis compras
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Consulta tus pedidos, reservas y material disponible.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6">
            {error}
          </div>
        )}

        {pedidos.length === 0 ? (
          <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-300 font-bold">Todavía no tienes compras.</p>
            <p className="text-slate-500 text-sm mt-2">
              Cuando compres o reserves material aparecerá aquí.
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 bg-red-600 hover:bg-red-500 px-6 py-3 rounded-xl font-bold cursor-pointer"
            >
              Explorar eventos
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {pedidos.map((pedido) => (
              <div
                key={pedido.id}
                className="bg-[#12131A] border border-slate-800 rounded-2xl overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Pedido</p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-xl font-black text-red-500">
                      ${Number(pedido.monto_total).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-800">
                  {pedido.items.map((item) => (
                    <div key={item.pedido_item_id} className="p-6">
                      <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
                        <div className="flex-1">
                          <p className="text-xs text-red-500 font-bold uppercase tracking-wider mb-1">
                            {item.evento.nombre}
                          </p>
                          <h2
                            className="text-2xl font-black uppercase"
                            style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
                          >
                            {item.participante.nombre_completo}
                          </h2>
                          <p className="text-sm text-slate-400 mt-1">
                            Dorsal #{item.participante.dorsal_numero}
                            {' · '}
                            {item.participante.nombre_categoria}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <span className="bg-[#181A24] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold">
                              {item.paquete.nombre_paquete}
                            </span>

                            {item.paquete.tipo !== 'video' && (
                              <span className="flex items-center gap-1.5 bg-[#181A24] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                                <ImageIcon size={14} />
                                {item.paquete.cantidad_fotos} fotos
                              </span>
                            )}

                            {item.paquete.tipo !== 'foto' && (
                              <span className="flex items-center gap-1.5 bg-[#181A24] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                                <Video size={14} />
                                1 video
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="lg:w-64 bg-[#0D111C] border border-slate-800 rounded-xl p-4">
                          {renderEstado(item)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}