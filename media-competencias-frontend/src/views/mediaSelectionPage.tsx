import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Image as ImageIcon, Loader2, ShoppingCart, Video } from 'lucide-react';
import { useCart } from '../context/cartContext';
import { useAuth } from '../context/authContext';
import { API_BASE } from '../config/api';
import { auth } from '../firebase/firebase';

interface PaqueteSeleccionado {
  id: string;
  nombre_paquete: string;
  descripcion: string;
  precio: number;
  tipo: 'foto' | 'video' | 'combo';
  cantidad_fotos: number;
}

interface ParticipanteSeleccionado {
  id: string;
  nombre_completo: string;
  dorsal_numero: string;
}

interface Multimedia {
  id: string;
  participante_id: string;
  tipo: 'FOTO' | 'VIDEO';
  nombre_archivo: string;
  mime_type: string | null;
  tamaño_bytes: number | null;
  previewUrl: string | null;
  activo: boolean;
  fecha_creacion: string;
}

interface LocationState {
  paquete?: PaqueteSeleccionado;
  participante?: ParticipanteSeleccionado;
  pedidoItemId?: string;
  modo?: 'DIRECTA' | 'RESERVA';
}

export default function MediaSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { participantId, pedidoItemId: pedidoItemIdParam } = useParams<{
    participantId?: string;
    pedidoItemId?: string;
  }>();
  

  const { user } = useAuth();
  const { addToCart } = useCart();

  const state = location.state as LocationState | null;

  const paquete = state?.paquete;
  const participante = state?.participante;
  const modo = state?.modo || 'DIRECTA';
  const esReserva = modo === 'RESERVA';
  const pedidoItemId = state?.pedidoItemId || pedidoItemIdParam;
  const [multimedia, setMultimedia] = useState<Multimedia[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const participanteIdEfectivo = participantId || participante?.id;

  useEffect(() => {
    const cargarMultimedia = async () => {
      if (!participanteIdEfectivo) {
        setError('No se encontró el participante.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const firebaseUser = auth.currentUser;

        if (!firebaseUser) {
          throw new Error(
            'Debes iniciar sesión para seleccionar material.'
          );
        }

        const token = await firebaseUser.getIdToken();

        const response = await fetch(
          `${API_BASE}/multimedia/participante/${participanteIdEfectivo}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            'No se pudo obtener el material del participante.'
          );
        }

        setMultimedia(data.multimedia || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Ocurrió un error cargando el material.'
        );
      } finally {
        setLoading(false);
      }
    };

    cargarMultimedia();
  }, [participanteIdEfectivo]);

  const fotos = useMemo(() => multimedia.filter(
    (item) =>
      item.tipo === 'FOTO' &&
      item.activo &&
      !!item.previewUrl
  ),
    [multimedia]
  );

  const videos = useMemo(() => multimedia.filter(
      (item) =>
        item.tipo === 'VIDEO' &&
        item.activo
    ),
  [multimedia]
);

  const fotosSeleccionadas = selectedIds.filter((id) =>
    fotos.some((foto) => foto.id === id)
  );

  const videosSeleccionados = selectedIds.filter((id) =>
    videos.some((video) => video.id === id)
  );

  const cantidadFotosRequeridas =
    Number(paquete?.cantidad_fotos || 0);

  const seleccionValida = useMemo(() => {
    if (!paquete) return false;

    if (paquete.tipo === 'foto') {
      return (
        fotosSeleccionadas.length === cantidadFotosRequeridas &&
        videosSeleccionados.length === 0
      );
    }

    if (paquete.tipo === 'video') {
      return (
        fotosSeleccionadas.length === 0 &&
        videosSeleccionados.length === 1
      );
    }

    if (paquete.tipo === 'combo') {
      return (
        fotosSeleccionadas.length === cantidadFotosRequeridas &&
        videosSeleccionados.length === 1
      );
    }

    return false;
  }, [
    paquete,
    cantidadFotosRequeridas,
    fotosSeleccionadas.length,
    videosSeleccionados.length
  ]);

  const toggleFoto = (id: string) => {
    if (!paquete) return;

    setSelectedIds((prev) => {
      const alreadySelected = prev.includes(id);

      if (alreadySelected) {
        return prev.filter(
          (selectedId) => selectedId !== id
        );
      }

      if (
        fotosSeleccionadas.length >= cantidadFotosRequeridas
      ) {
        return prev;
      }

      return [...prev, id];
    });
  };

  const toggleVideo = (id: string) => {
    setSelectedIds((prev) => {
      const idsSinVideos = prev.filter(
        (selectedId) =>
          !videos.some(
            (video) => video.id === selectedId
          )
      );

      if (prev.includes(id)) {
        return idsSinVideos;
      }

      return [...idsSinVideos, id];
    });
  };

  const handleConfirmarSeleccion = async () => {
  if (!paquete || !participante) {
    setError('No se encontró la información del paquete o participante.');
    return;
  }

  if (!seleccionValida) {
    setError('Debes completar la selección requerida por el paquete.');
    return;
  }

  // =====================================================
  // COMPRA DIRECTA
  // =====================================================
  if (!esReserva) {
    addToCart(
      {
        id: paquete.id,
        nombre_paquete: paquete.nombre_paquete,
        descripcion: paquete.descripcion || '',
        precio: Number(paquete.precio),
        tipo: paquete.tipo
      },
      {
        id: participante.id,
        nombre_completo: participante.nombre_completo,
        dorsal_numero: participante.dorsal_numero
      },
      selectedIds,
      'DIRECTA'
    );

    navigate('/carrito');
    return;
  }

  // =====================================================
  // RESERVA YA PAGADA
  // =====================================================
  if (!pedidoItemId) {
    setError('No se encontró el pedido asociado a esta reserva.');
    return;
  }

  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    setError('Debes iniciar sesión para completar tu reserva.');
    return;
  }

  try {
    setConfirmando(true);
    setError(null);

    const token = await firebaseUser.getIdToken();

    const response = await fetch(
      `${API_BASE}/pedidos/${pedidoItemId}/seleccionar-material`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          multimedia_ids: selectedIds
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo guardar la selección.');
    }

    navigate('/mis-compras', { replace: true });
  } catch (err) {
    console.error('Error confirmando selección:', err);
    setError(
      err instanceof Error ? err.message : 'No se pudo guardar la selección.'
    );
  } finally {
    setConfirmando(false);
  }
};

  if (!paquete || !participante) {
    return (
      <div className="min-h-screen bg-[#0D111C] text-white flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-3">
            No se encontró la información de la compra.
          </h2>

          <p className="text-slate-400 mb-6">
            Regresa al paquete e intenta nuevamente.
          </p>

          <button
            onClick={() => navigate(-1)}
            className="bg-red-600 hover:bg-red-500 px-6 py-3 rounded-xl font-bold cursor-pointer"
          >
            Regresar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D111C] text-white pt-24 pb-32">
      <div className="max-w-6xl mx-auto px-6">

        <button
          onClick={() =>
            esReserva
              ? navigate('/mis-compras')
              : navigate(-1)
          }
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium mb-8 cursor-pointer"
        >
          <ArrowLeft size={16} />

          {esReserva
            ? 'Volver a mis compras'
            : 'Volver a paquetes'}
        </button>

        <div className="mb-8">
          <p className="text-red-500 text-sm font-bold uppercase tracking-wider mb-2">
            Selección de material
          </p>

          <h1
            className="text-3xl md:text-4xl font-black uppercase"
            style={{
              fontFamily: '"Barlow Condensed", sans-serif'
            }}
          >
            {paquete.nombre_paquete}
          </h1>
          {esReserva && (
            <div className="mt-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-sm font-bold text-emerald-400">Tu paquete ya está pagado</p>
              <p className="text-xs text-slate-400 mt-1">Selecciona el material incluido en tu compra.
                No tendrás que realizar ningún pago adicional.</p>
            </div>
          )}

          <p className="text-slate-400 mt-2">
            {participante.nombre_completo}
            {' • '}
            Dorsal #{participante.dorsal_numero}
          </p>
        </div>

        <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-5 mb-8">
          {paquete.tipo === 'foto' && (
            <p className="text-sm text-slate-300">
              Selecciona exactamente{' '}
              <strong className="text-white">
                {cantidadFotosRequeridas} fotos
              </strong>
              .
            </p>
          )}

          {paquete.tipo === 'video' && (
            <p className="text-sm text-slate-300">
              Selecciona{' '}
              <strong className="text-white">
                1 video
              </strong>
              .
            </p>
          )}

          {paquete.tipo === 'combo' && (
            <p className="text-sm text-slate-300">
              Selecciona exactamente{' '}
              <strong className="text-white">
                {cantidadFotosRequeridas} fotos
              </strong>{' '}
              y{' '}
              <strong className="text-white">
                1 video
              </strong>
              .
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2
              size={36}
              className="animate-spin mb-4"
            />
            <p>Cargando material...</p>
          </div>
        ) : (
          <>
            {(paquete.tipo === 'foto' ||
              paquete.tipo === 'combo') && (
                <section className="mb-12">

                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <ImageIcon
                        size={20}
                        className="text-red-500"
                      />

                      <h2 className="font-bold text-xl uppercase">
                        Fotografías
                      </h2>
                    </div>

                    <span className="text-sm text-slate-400">
                      {fotosSeleccionadas.length}/
                      {cantidadFotosRequeridas}
                    </span>
                  </div>

                  {fotos.length === 0 ? (
                    <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
                      No hay fotografías disponibles todavía.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {fotos.map((foto) => {
                        const selected =
                          selectedIds.includes(foto.id);

                        return (
                          <button
                            key={foto.id}
                            type="button"
                            onClick={() =>
                              toggleFoto(foto.id)
                            }
                            className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer aspect-[4/5] ${selected
                                ? 'border-red-500'
                                : 'border-slate-800 hover:border-slate-600'
                              }`}
                          >
                            {foto.previewUrl ? (
                              <img
                                src={foto.previewUrl}
                                alt="Vista previa"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-[#181A24] flex items-center justify-center">
                                <ImageIcon className="text-slate-600" />
                              </div>
                            )}

                            {selected && (
                              <div className="absolute inset-0 bg-red-600/20">
                                <div className="absolute top-3 right-3 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                                  <Check size={18} />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

            {(paquete.tipo === 'video' ||
              paquete.tipo === 'combo') && (
                <section>

                  <div className="flex items-center gap-2 mb-5">
                    <Video
                      size={20}
                      className="text-red-500"
                    />

                    <h2 className="font-bold text-xl uppercase">
                      Video
                    </h2>
                  </div>

                  {videos.length === 0 ? (
                    <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
                      No hay video disponible todavía.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {videos.map((video) => {
                        const selected =
                          selectedIds.includes(video.id);

                        return (
                          <button
                            key={video.id}
                            type="button"
                            onClick={() =>
                              toggleVideo(video.id)
                            }
                            className={`w-full flex items-center justify-between p-5 rounded-xl border transition-all cursor-pointer ${selected
                                ? 'border-red-500 bg-red-500/10'
                                : 'border-slate-800 bg-[#12131A] hover:border-slate-600'
                              }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-[#181A24] rounded-xl flex items-center justify-center">
                                <Video
                                  size={22}
                                  className="text-red-500"
                                />
                              </div>

                              <div className="text-left">
                                <p className="font-bold">
                                  Video del participante
                                </p>

                                <p className="text-xs text-slate-500">
                                  {video.nombre_archivo}
                                </p>
                              </div>
                            </div>

                            {selected && (
                              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                                <Check size={18} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
          </>
        )}
      </div>

      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0D111C]/95 backdrop-blur border-t border-slate-800 z-40">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between">

            <div>
              <p className="text-xs text-slate-500 uppercase font-bold">
                Tu selección
              </p>

              <p className="text-sm text-white">
                {paquete.tipo !== 'video' &&
                  `${fotosSeleccionadas.length}/${cantidadFotosRequeridas} fotos`}

                {paquete.tipo === 'combo' && ' + '}

                {paquete.tipo !== 'foto' &&
                  `${videosSeleccionados.length}/1 video`}
              </p>
            </div>

            <div className="flex items-center gap-5 w-full sm:w-auto">
              <span
                className="text-2xl font-black text-red-500"
                style={{
                  fontFamily:
                    '"Barlow Condensed", sans-serif'
                }}
              >
                ${Number(paquete.precio).toFixed(2)}
              </span>

              <button
                type="button"
                disabled={!seleccionValida || confirmando}
                onClick={handleConfirmarSeleccion}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold uppercase transition-all ${
                  seleccionValida && !confirmando
                    ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {confirmando ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Guardando...
                  </>
                ) : esReserva ? (
                  <>
                    <Check size={18} />
                    Confirmar selección
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} />
                    Añadir al carrito
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}