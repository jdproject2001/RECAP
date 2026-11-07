import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  CircleDollarSign,
  FileVideo,
  FilterX,
  Loader2,
  Search,
  Users,
  XCircle
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import { API_BASE } from '../config/api';

interface Evento {
  id: string;
  nombre: string;
  fecha?: string;
  lugar?: string;
  activo?: boolean;
}

interface RegistroDashboard {
  participante_id: string;
  categoria_id: string;
  nombre_categoria: string;
  orden_categoria: number;
  participante: string;
  orden: string;
  academia: string | null;

  estado_video: 'SUBIDO' | 'PENDIENTE';
  nombre_archivo: string;
  fecha_subida_video: string | null;

  cantidad_fotos: number;
  estado_fotos: 'COMPLETO' | 'PENDIENTE';
  fecha_ultima_foto: string | null;

  estado_pedido?: 'PAGADO' | 'NO PAGADO';
}

interface ResumenDashboard {
  totalParticipantes: number;
  videosSubidos: number;
  videosPendientes: number;
  fotosCompletas: number;
  fotosPendientes: number;
  pagados?: number;
  noPagados?: number;
}

interface DashboardResponse {
  evento: Evento;
  rol: 'admin' | 'tecnico';
  puedeVerPagos: boolean;
  resumen: ResumenDashboard;
  total: number;
  registros: RegistroDashboard[];
}

type TipoMultimedia = 'VIDEO' | 'FOTO';

export default function AdminEventDashboardPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState('');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);

  const [loadingEventos, setLoadingEventos] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tipoMultimedia, setTipoMultimedia] = useState<TipoMultimedia>('VIDEO');
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [academia, setAcademia] = useState('');
  const [estadoMultimedia, setEstadoMultimedia] = useState('');
  const [estadoPedido, setEstadoPedido] = useState('');

  // =====================================================
  // CARGAR EVENTOS
  // =====================================================
  useEffect(() => {
    const cargarEventos = async () => {
      try {
        setLoadingEventos(true);
        setError(null);

        const response = await fetch(`${API_BASE}/eventos`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'No se pudieron cargar los eventos.');
        }

        setEventos(data || []);
      } catch (err) {
        console.error('Error cargando eventos:', err);
        setError(err instanceof Error ? err.message : 'Error cargando eventos.');
      } finally {
        setLoadingEventos(false);
      }
    };

    cargarEventos();
  }, []);

  // =====================================================
  // CARGAR DASHBOARD
  // =====================================================
  useEffect(() => {
    if (!eventoId) {
      setDashboard(null);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError('Debes iniciar sesión para acceder al dashboard.');
        setDashboard(null);
        return;
      }

      try {
        setLoadingDashboard(true);
        setError(null);

        const token = await user.getIdToken();

        const response = await fetch(
          `${API_BASE}/dashboard/evento/${eventoId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'No se pudo cargar el dashboard.');
        }

        setDashboard(data);
      } catch (err) {
        console.error('Error cargando dashboard:', err);
        setDashboard(null);
        setError(err instanceof Error ? err.message : 'Error cargando dashboard.');
      } finally {
        setLoadingDashboard(false);
      }
    });

    return () => unsubscribe();
  }, [eventoId]);

  // =====================================================
  // LIMPIAR FILTROS AL CAMBIAR EVENTO
  // =====================================================
  useEffect(() => {
    setBusqueda('');
    setCategoria('');
    setAcademia('');
    setEstadoMultimedia('');
    setEstadoPedido('');
  }, [eventoId]);

  // =====================================================
  // LIMPIAR ESTADO AL CAMBIAR FOTO / VIDEO
  // =====================================================
  useEffect(() => {
    setEstadoMultimedia('');
  }, [tipoMultimedia]);

  // =====================================================
  // CATEGORÍAS
  // =====================================================
  const categoriasDisponibles = useMemo(() => {
    if (!dashboard) return [];

    const mapa = new Map<string, string>();

    dashboard.registros.forEach((registro) => {
      mapa.set(registro.categoria_id, registro.nombre_categoria);
    });

    return Array.from(mapa.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [dashboard]);

  // =====================================================
  // ACADEMIAS
  // =====================================================
  const academiasDisponibles = useMemo(() => {
    if (!dashboard) return [];

    const academias = new Set<string>();

    dashboard.registros.forEach((registro) => {
      const valor = registro.academia?.trim();
      if (valor) academias.add(valor);
    });

    return Array.from(academias).sort((a, b) => a.localeCompare(b));
  }, [dashboard]);

  // =====================================================
  // FILTRAR REGISTROS
  // =====================================================
  const registrosFiltrados = useMemo(() => {
    if (!dashboard) return [];

    const texto = busqueda.trim().toLowerCase();

    return dashboard.registros.filter((registro) => {
      const coincideCategoria =
        !categoria || registro.categoria_id === categoria;

      const coincideAcademia =
        !academia || registro.academia === academia;

      const coincideEstado =
        !estadoMultimedia ||
        (
          tipoMultimedia === 'VIDEO'
            ? registro.estado_video === estadoMultimedia
            : registro.estado_fotos === estadoMultimedia
        );

      const coincidePedido =
        !dashboard.puedeVerPagos ||
        !estadoPedido ||
        registro.estado_pedido === estadoPedido;

      const coincideBusqueda =
        !texto ||
        registro.participante?.toLowerCase().includes(texto) ||
        registro.orden?.toString().toLowerCase().includes(texto) ||
        registro.nombre_archivo?.toLowerCase().includes(texto) ||
        registro.academia?.toLowerCase().includes(texto) ||
        registro.nombre_categoria?.toLowerCase().includes(texto);

      return (
        coincideCategoria &&
        coincideAcademia &&
        coincideEstado &&
        coincidePedido &&
        coincideBusqueda
      );
    });
  }, [
    dashboard,
    categoria,
    academia,
    estadoMultimedia,
    estadoPedido,
    busqueda,
    tipoMultimedia
  ]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setCategoria('');
    setAcademia('');
    setEstadoMultimedia('');
    setEstadoPedido('');
  };

  const formatFecha = (fecha?: string | null) => {
    if (!fecha) return '—';

    return new Date(fecha).toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-[#0D111C] text-white pt-8 pb-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6">

        {/* CABECERA */}
        <div className="mb-8">
          <p className="text-red-500 text-xs font-bold uppercase tracking-[0.2em] mb-2">
            Administración
          </p>

          <h1
            className="text-3xl md:text-4xl font-black uppercase"
            style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
          >
            Reporte del evento
          </h1>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* SELECTOR EVENTO + VIDEO/FOTO */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 mb-8">

          {/* EVENTO */}
          <div className="flex-1">
            <label className="block text-xs uppercase font-bold text-slate-400 mb-2">
              Evento
            </label>

            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              disabled={loadingEventos}
              className="w-full bg-[#181A24] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500"
            >
              <option value="">Selecciona un evento</option>

              {eventos.map((evento) => (
                <option key={evento.id} value={evento.id}>
                  {evento.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* SELECTOR VIDEO / FOTO */}
          <div className="flex items-center gap-2 bg-[#12131A] border border-slate-800 rounded-xl p-1.5">
            <button
              type="button"
              onClick={() => setTipoMultimedia('VIDEO')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${tipoMultimedia === 'VIDEO'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <FileVideo size={17} />
              Videos
            </button>

            <button
              type="button"
              onClick={() => setTipoMultimedia('FOTO')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${tipoMultimedia === 'FOTO'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Camera size={17} />
              Fotos
            </button>
          </div>

        </div>
        {!eventoId && (
          <div className="bg-[#12131A] border border-slate-800 rounded-2xl py-20 text-center text-slate-500">
            Selecciona un evento para consultar el dashboard.
          </div>
        )}

        {eventoId && loadingDashboard && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 size={36} className="animate-spin text-red-500 mb-4" />
            <p>Cargando información...</p>
          </div>
        )}

        {eventoId && !loadingDashboard && dashboard && (
          <>
            {/* INFORMACIÓN DEL EVENTO */}
            <div className="mb-6">
              <h2 className="text-2xl font-black uppercase">
                {dashboard.evento.nombre}
              </h2>
            </div>



            {/* RESUMEN */}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 ${dashboard.puedeVerPagos ? 'lg:grid-cols-5' : 'lg:grid-cols-3'
                } gap-4 mb-8`}
            >
              {/* TOTAL PARTICIPANTES */}
              <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-5">
                <Users size={20} className="text-slate-400 mb-4" />

                <p className="text-xs uppercase text-slate-500 font-bold">
                  Participantes
                </p>

                <p className="text-3xl font-black mt-1">
                  {dashboard.resumen.totalParticipantes}
                </p>
              </div>

              {/* VIDEO */}
              {tipoMultimedia === 'VIDEO' && (
                <>
                  <div className="bg-[#12131A] border border-emerald-500/20 rounded-2xl p-5">
                    <CheckCircle2 size={20} className="text-emerald-500 mb-4" />

                    <p className="text-xs uppercase text-slate-500 font-bold">
                      Videos subidos
                    </p>

                    <p className="text-3xl font-black text-emerald-400 mt-1">
                      {dashboard.resumen.videosSubidos}
                    </p>
                  </div>

                  <div className="bg-[#12131A] border border-amber-500/20 rounded-2xl p-5">
                    <FileVideo size={20} className="text-amber-400 mb-4" />

                    <p className="text-xs uppercase text-slate-500 font-bold">
                      Videos pendientes
                    </p>

                    <p className="text-3xl font-black text-amber-400 mt-1">
                      {dashboard.resumen.videosPendientes}
                    </p>
                  </div>
                </>
              )}

              {/* FOTOS */}
              {tipoMultimedia === 'FOTO' && (
                <>
                  <div className="bg-[#12131A] border border-emerald-500/20 rounded-2xl p-5">
                    <CheckCircle2 size={20} className="text-emerald-500 mb-4" />

                    <p className="text-xs uppercase text-slate-500 font-bold">
                      Fotos completas
                    </p>

                    <p className="text-3xl font-black text-emerald-400 mt-1">
                      {dashboard.resumen.fotosCompletas}
                    </p>
                  </div>

                  <div className="bg-[#12131A] border border-amber-500/20 rounded-2xl p-5">
                    <Camera size={20} className="text-amber-400 mb-4" />

                    <p className="text-xs uppercase text-slate-500 font-bold">
                      Fotos pendientes
                    </p>

                    <p className="text-3xl font-black text-amber-400 mt-1">
                      {dashboard.resumen.fotosPendientes}
                    </p>
                  </div>
                </>
              )}

              {/* PAGADOS */}
              {dashboard.puedeVerPagos && (
                <>
                  <div className="bg-[#12131A] border border-emerald-500/20 rounded-2xl p-5">
                    <CircleDollarSign size={20} className="text-emerald-500 mb-4" />

                    <p className="text-xs uppercase text-slate-500 font-bold">
                      Pagados
                    </p>

                    <p className="text-3xl font-black text-emerald-400 mt-1">
                      {dashboard.resumen.pagados || 0}
                    </p>
                  </div>

                  <div className="bg-[#12131A] border border-red-500/20 rounded-2xl p-5">
                    <XCircle size={20} className="text-red-400 mb-4" />

                    <p className="text-xs uppercase text-slate-500 font-bold">
                      No pagados
                    </p>

                    <p className="text-3xl font-black text-red-400 mt-1">
                      {dashboard.resumen.noPagados || 0}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* FILTROS */}
            <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <h3 className="font-bold uppercase">Filtros</h3>

                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  <FilterX size={16} />
                  Limpiar filtros
                </button>
              </div>

              <div className="relative mb-4">
                <Search
                  size={17}
                  className="absolute left-4 top-3.5 text-slate-500"
                />

                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por participante, dorsal, academia o archivo..."
                  className="w-full bg-[#181A24] border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-sm placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div
                className={`grid grid-cols-1 sm:grid-cols-2 ${dashboard.puedeVerPagos ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
                  } gap-3`}
              >
                {/* CATEGORÍA */}
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="bg-[#181A24] border border-slate-700 rounded-xl p-3 text-sm"
                >
                  <option value="">Todas las categorías</option>

                  {categoriasDisponibles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>

                {/* ACADEMIA */}
                <select
                  value={academia}
                  onChange={(e) => setAcademia(e.target.value)}
                  className="bg-[#181A24] border border-slate-700 rounded-xl p-3 text-sm"
                >
                  <option value="">Todas las academias</option>

                  {academiasDisponibles.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                {/* ESTADO FOTO / VIDEO */}
                <select
                  value={estadoMultimedia}
                  onChange={(e) => setEstadoMultimedia(e.target.value)}
                  className="bg-[#181A24] border border-slate-700 rounded-xl p-3 text-sm"
                >
                  {tipoMultimedia === 'VIDEO' ? (
                    <>
                      <option value="">Todos los videos</option>
                      <option value="SUBIDO">Subidos</option>
                      <option value="PENDIENTE">Pendientes</option>
                    </>
                  ) : (
                    <>
                      <option value="">Todas las fotos</option>
                      <option value="COMPLETO">Completas</option>
                      <option value="PENDIENTE">Pendientes</option>
                    </>
                  )}
                </select>

                {/* PEDIDO */}
                {dashboard.puedeVerPagos && (
                  <select
                    value={estadoPedido}
                    onChange={(e) => setEstadoPedido(e.target.value)}
                    className="bg-[#181A24] border border-slate-700 rounded-xl p-3 text-sm"
                  >
                    <option value="">Todos los pedidos</option>
                    <option value="PAGADO">Pagados</option>
                    <option value="NO PAGADO">No pagados</option>
                  </select>
                )}
              </div>
            </div>

            {/* CONTADOR */}
            <div className="flex justify-between items-center mb-3 text-sm">
              <span className="text-slate-400">
                {registrosFiltrados.length}{' '}
                {registrosFiltrados.length === 1 ? 'resultado' : 'resultados'}
              </span>

              <span className="text-slate-500 text-xs">
                Rol: {dashboard.rol}
              </span>
            </div>

            {/* TABLA */}
            <div className="bg-[#12131A] border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="bg-[#181A24] text-slate-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-4">Dorsal</th>
                      <th className="text-left px-4 py-4">Participante</th>
                      <th className="text-left px-4 py-4">Categoría</th>
                      <th className="text-left px-4 py-4">Academia</th>

                      {tipoMultimedia === 'VIDEO' ? (
                        <>
                          <th className="text-left px-4 py-4">Video</th>
                          <th className="text-left px-4 py-4">Archivo</th>
                          <th className="text-left px-4 py-4">Fecha subida</th>
                        </>
                      ) : (
                        <>
                          <th className="text-left px-4 py-4">Cantidad fotos</th>
                          <th className="text-left px-4 py-4">Estado</th>
                          <th className="text-left px-4 py-4">Última subida</th>
                        </>
                      )}

                      {dashboard.puedeVerPagos && (
                        <th className="text-left px-4 py-4">Pedido</th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {registrosFiltrados.length === 0 ? (
                      <tr>
                        <td
                          colSpan={dashboard.puedeVerPagos ? 8 : 7}
                          className="text-center text-slate-500 py-16"
                        >
                          No hay resultados para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      registrosFiltrados.map((registro) => (
                        <tr
                          key={registro.participante_id}
                          className="border-t border-slate-800 hover:bg-white/[0.02] transition-colors"
                        >
                          {/* DORSAL */}
                          <td className="px-4 py-4">
                            <span className="font-mono font-bold text-red-400">
                              #{registro.orden || 'S/N'}
                            </span>
                          </td>

                          {/* PARTICIPANTE */}
                          <td className="px-4 py-4 font-bold">
                            {registro.participante}
                          </td>

                          {/* CATEGORÍA */}
                          <td className="px-4 py-4 text-slate-300">
                            {registro.nombre_categoria}
                          </td>

                          {/* ACADEMIA */}
                          <td className="px-4 py-4 text-slate-400">
                            {registro.academia || '—'}
                          </td>

                          {/* VIDEO */}
                          {tipoMultimedia === 'VIDEO' && (
                            <>
                              <td className="px-4 py-4">
                                {registro.estado_video === 'SUBIDO' ? (
                                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-2.5 py-1 text-xs font-bold">
                                    <CheckCircle2 size={14} />
                                    Subido
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg px-2.5 py-1 text-xs font-bold">
                                    <FileVideo size={14} />
                                    Pendiente
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-4 max-w-[260px]">
                                <p
                                  className="truncate text-slate-300"
                                  title={registro.nombre_archivo}
                                >
                                  {registro.nombre_archivo}
                                </p>
                              </td>

                              <td className="px-4 py-4 text-slate-500 whitespace-nowrap">
                                {formatFecha(registro.fecha_subida_video)}
                              </td>
                            </>
                          )}

                          {/* FOTOS */}
                          {tipoMultimedia === 'FOTO' && (
                            <>
                              <td className="px-4 py-4">
                                <span className="font-bold">
                                  {Number(registro.cantidad_fotos || 0)}
                                </span>

                                <span className="text-slate-500 text-xs ml-1">
                                  fotos
                                </span>
                              </td>

                              <td className="px-4 py-4">
                                {registro.estado_fotos === 'COMPLETO' ? (
                                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-2.5 py-1 text-xs font-bold">
                                    <CheckCircle2 size={14} />
                                    Completo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg px-2.5 py-1 text-xs font-bold">
                                    <Camera size={14} />
                                    Pendiente
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-4 text-slate-500 whitespace-nowrap">
                                {formatFecha(registro.fecha_ultima_foto)}
                              </td>
                            </>
                          )}

                          {/* PEDIDO */}
                          {dashboard.puedeVerPagos && (
                            <td className="px-4 py-4">
                              {registro.estado_pedido === 'PAGADO' ? (
                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg text-xs font-bold">
                                  Pagado
                                </span>
                              ) : (
                                <span className="bg-slate-800 border border-slate-700 text-slate-400 px-2.5 py-1 rounded-lg text-xs font-bold">
                                  No pagado
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}