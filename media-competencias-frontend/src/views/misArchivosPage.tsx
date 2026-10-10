import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileVideo, Image as ImageIcon, Loader2 } from 'lucide-react';
import { API_BASE } from '../config/api';
import { auth } from '../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface Archivo {
  id: string;
  tipo: 'FOTO' | 'VIDEO';
  nombre_archivo: string;
  mime_type: string | null;
  tamaño_bytes: number | null;
  previewUrl: string | null;
  fecha_creacion: string;
}

interface Participante {
  id: string;
  nombre_completo: string;
  dorsal_numero: string;
}

interface Paquete {
  id: string;
  nombre_paquete: string;
  tipo: 'foto' | 'video' | 'combo';
  cantidad_fotos: number;
}

interface ArchivosResponse {
  pedido_item_id: string;
  participante: Participante;
  paquete: Paquete;
  total_archivos: number;
  archivos: Archivo[];
}

export default function MisArchivosPage() {
  const navigate = useNavigate();
  const { pedidoItemId } = useParams<{ pedidoItemId: string }>();

  const [data, setData] = useState<ArchivosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);

  // =====================================================
  // CARGAR ARCHIVOS COMPRADOS (Escuchando auth)
  // =====================================================

  useEffect(() => {
    if (!pedidoItemId) {
      setError('No se encontró el pedido.');
      setLoading(false);
      return;
    }

    // Usamos onAuthStateChanged para esperar a que Firebase
    // resuelva el estado de la sesión si el usuario recarga la página.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError('Debes iniciar sesión para ver tus archivos.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const token = await user.getIdToken();

        const response = await fetch(
          `${API_BASE}/pedidos/${pedidoItemId}/archivos`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(
            responseData.error || 'No se pudieron cargar tus archivos.'
          );
        }

        setData(responseData);
      } catch (err) {
        console.error('Error cargando archivos:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Ocurrió un error inesperado al cargar los archivos.'
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [pedidoItemId]);

  // =====================================================
  // SEPARAR FOTOS Y VIDEO
  // =====================================================

  const fotos = useMemo(
    () => data?.archivos.filter((archivo) => archivo.tipo === 'FOTO') || [],
    [data]
  );

  const videos = useMemo(
    () => data?.archivos.filter((archivo) => archivo.tipo === 'VIDEO') || [],
    [data]
  );

  // =====================================================
  // DESCARGAR ORIGINAL
  // =====================================================

  const handleDescargar = async (archivo: Archivo) => {
    try {
      setDescargandoId(archivo.id);
      setError(null);

      const user = auth.currentUser;
      if (!user) {
        throw new Error('Debes iniciar sesión para descargar archivos.');
      }

      const token = await user.getIdToken();

      const response = await fetch(
        `${API_BASE}/multimedia/${archivo.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.error || 'No se pudo generar el enlace de descarga.'
        );
      }

      if (!responseData.downloadUrl) {
        throw new Error('El servidor no devolvió una URL de descarga válida.');
      }

      // Forzar la descarga mediante la creación temporal de un elemento <a>
      const anchor = document.createElement('a');
      anchor.href = responseData.downloadUrl;
      anchor.download = archivo.nombre_archivo || 'descarga';
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (err) {
      console.error('Error descargando archivo:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo descargar el archivo.'
      );
    } finally {
      setDescargandoId(null);
    }
  };

  // =====================================================
  // FORMATOS DE TAMAÑO
  // =====================================================

  const formatFileSize = (bytes: number | null) => {
    if (!bytes || bytes === 0) return '';

    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  // =====================================================
  // ESTADO: LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D111C] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={38}
            className="animate-spin text-red-500 mx-auto mb-4"
          />
          <p className="text-slate-400">Cargando tus archivos...</p>
        </div>
      </div>
    );
  }

  // =====================================================
  // ESTADO: ERROR SIN DATA
  // =====================================================

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0D111C] text-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold">No se pudieron cargar tus archivos</h2>
          <p className="text-slate-400 mt-2">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/mis-compras')}
            className="mt-6 bg-red-600 hover:bg-red-500 px-6 py-3 rounded-xl font-bold cursor-pointer transition-colors"
          >
            Volver a mis compras
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D111C] text-white pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        
        {/* VOLVER */}
        <button
          type="button"
          onClick={() => navigate('/mis-compras')}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-8 cursor-pointer transition-colors"
        >
          <ArrowLeft size={16} />
          Volver a mis compras
        </button>

        {/* CABECERA */}
        <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-6 mb-8">
          <p className="text-red-500 text-xs font-bold uppercase tracking-[0.2em] mb-2">
            Tus archivos
          </p>

          <h1
            className="text-3xl md:text-4xl font-black uppercase tracking-wide"
            style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
          >
            {data.participante.nombre_completo}
          </h1>

          <p className="text-slate-400 mt-1">
            Dorsal #{data.participante.dorsal_numero}
          </p>

          <div className="flex flex-wrap gap-3 mt-5">
            <span className="bg-[#181A24] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold">
              {data.paquete.nombre_paquete}
            </span>

            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg px-3 py-1.5 text-xs font-bold">
              Compra completada
            </span>

            <span className="bg-[#181A24] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
              {data.total_archivos}{' '}
              {data.total_archivos === 1 ? 'archivo' : 'archivos'}
            </span>
          </div>
        </div>

        {/* MENSAJE DE ERROR GLOBAL */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* SECCIÓN: FOTOGRAFÍAS */}
        {fotos.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <ImageIcon size={20} className="text-red-500" />
              <h2
                className="text-xl font-black uppercase"
                style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
              >
                Fotografías
              </h2>
              <span className="text-sm text-slate-500">({fotos.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {fotos.map((foto) => (
                <div
                  key={foto.id}
                  className="bg-[#12131A] border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[4/5] bg-[#181A24] relative">
                      {foto.previewUrl ? (
                        <img
                          src={foto.previewUrl}
                          alt={foto.nombre_archivo}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={36} className="text-slate-600" />
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <p
                        className="text-sm font-medium truncate"
                        title={foto.nombre_archivo}
                      >
                        {foto.nombre_archivo}
                      </p>

                      {foto.tamaño_bytes && (
                        <p className="text-xs text-slate-500 mt-1">
                          {formatFileSize(foto.tamaño_bytes)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <button
                      type="button"
                      onClick={() => handleDescargar(foto)}
                      disabled={descargandoId === foto.id}
                      className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                    >
                      {descargandoId === foto.id ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Preparando...
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          Descargar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECCIÓN: VIDEO */}
        {videos.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <FileVideo size={20} className="text-red-500" />
              <h2
                className="text-xl font-black uppercase"
                style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
              >
                Video
              </h2>
            </div>

            <div className="space-y-4">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="bg-[#12131A] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
                      <FileVideo size={25} className="text-red-500" />
                    </div>

                    <div className="min-w-0">
                      <p
                        className="font-bold truncate"
                        title={video.nombre_archivo}
                      >
                        {video.nombre_archivo}
                      </p>

                      <div className="flex gap-2 text-xs text-slate-500 mt-1">
                        <span>Video</span>
                        {video.tamaño_bytes && (
                          <>
                            <span>•</span>
                            <span>{formatFileSize(video.tamaño_bytes)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDescargar(video)}
                    disabled={descargandoId === video.id}
                    className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer shrink-0"
                  >
                    {descargandoId === video.id ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Preparando...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Descargar video
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CASO: SIN ARCHIVOS */}
        {data.archivos.length === 0 && (
          <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-12 text-center">
            <p className="font-bold">No hay archivos disponibles.</p>
            <p className="text-sm text-slate-500 mt-2">
              Tu compra todavía no tiene archivos asociados.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}