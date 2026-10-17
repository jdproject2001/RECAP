import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Search, Users, MapPin, Calendar, ChevronRight, ChevronDown, Building2 } from "lucide-react";
import { API_BASE } from '../config/api';

// Interfaces actualizadas al esquema relacional de la BD
interface Evento {
  id: string; // UUID
  nombre: string;
  fecha: string;
  lugar: string;
  activo: boolean;
  slug: string,
  imagen_url?: string;
}

interface ParticipanteDTO {
  id: string; // UUID
  nombre_completo: string;
  dorsal_numero: string;
  nombre_categoria: string;
  tipo_categoria?: 'SOLISTA' | 'DUO' | 'GRUPAL' | 'EQUIPO' | string;
  academia?: string;
  categoria_id?: string;
}

interface PaqueteDTO {
  id: string;
  nombre_paquete: string;
  tipo: 'foto' | 'video' | 'combo';
  modalidad: 'SOLISTA_DUO' | 'GRUPAL' | 'TODOS';
  cantidad_fotos?: number;
  precio: number | string;
}

export default function EventPage() {
  //const { eventId } = useParams<{ eventId: string }>();
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const navigate = useNavigate();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteDTO[]>([]);
  const [paquetes, setPaquetes] = useState<PaqueteDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de Filtro
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");

  // Obtención de datos del Backend
  useEffect(() => {
    if (!eventSlug) {
      setError("Evento no encontrado");
      setLoading(false);
      return;
    }

    const fetchEventData = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/eventos/slug/${eventSlug}`);
        if (!res.ok) throw new Error(`Error ${res.status}: No se pudo cargar el evento`);

        const data = await res.json();

        setEvento(data.evento || null);
        setParticipantes(data.participantes || []);
        setPaquetes(data.paquetes || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error al conectar con la base de datos.");
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventSlug]);

  // Extraer categorías dinámicas desde los participantes recibidos
  const categories = useMemo(() => {
    const cats = [...new Set(participantes.map((p) => p.nombre_categoria))].filter(Boolean).sort();
    return ["Todos", ...cats];
  }, [participantes]);

  // Filtrado de la tabla en tiempo real (por Nombre, Dorsal o Academia)
  const filtered = useMemo(() => {
    const queryLower = search.toLowerCase();
    return participantes.filter((p) => {
      const matchSearch =
        p.nombre_completo.toLowerCase().includes(queryLower) ||
        (p.dorsal_numero && p.dorsal_numero.toString().includes(queryLower)) ||
        (p.academia && p.academia.toLowerCase().includes(queryLower));

      const matchCat = activeCategory === "Todos" || p.nombre_categoria === activeCategory;
      return matchSearch && matchCat;
    });
  }, [participantes, search, activeCategory]);

  // Manejador para navegar hacia la selección de paquetes
  const handleSelectParticipant = (participant: ParticipanteDTO) => {
    // Si la modalidad del paquete debe responder al tipo de categoría:
    const tipoCat = (participant.tipo_categoria || '').toUpperCase();
    const esGrupal = tipoCat === 'GRUPAL' || tipoCat === 'EQUIPO';

    const paquetesFiltrados = paquetes.filter((pkg) => {
      if (!pkg.modalidad || pkg.modalidad === 'TODOS') return true;
      if (esGrupal) return pkg.modalidad === 'GRUPAL';
      return pkg.modalidad === 'SOLISTA_DUO';
    });

    if (!evento) {
      return;
    }

    navigate(`/${eventSlug}/participante/${participant.id}`, {
      state: {
        participante: participant,
        evento: evento,
        paquetes: paquetesFiltrados.length > 0 ? paquetesFiltrados : paquetes
      }
    });
  };

  // Helper para pintar badges según tipo de categoría
  const renderTipoBadge = (tipo?: string) => {
    if (!tipo) return null;
    const t = tipo.toUpperCase();
    if (t === 'GRUPAL' || t === 'EQUIPO') {
      return (
        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase">
          Grupal
        </span>
      );
    }
    if (t === 'DUO') {
      return (
        <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded uppercase">
          Dúo
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded uppercase">
        Solista
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Cargando participantes...</p>
        </div>
      </div>
    );
  }

  if (error || !evento) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center text-slate-400">
        <div className="text-center space-y-4">
          <p className="text-lg text-slate-300 font-medium">{error || "Evento no encontrado"}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-500 transition-colors cursor-pointer"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0B0F17]/90 backdrop-blur-md border-b border-slate-800">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Volver</span>
        </button>

        <Link to="/" className="flex items-center gap-2">
          <div className="flex flex-col leading-none">
            <span className="text-base font-black tracking-widest text-white uppercase" style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: "0.18em" }}>
              RECAP
            </span>
            <span className="text-[9px] font-semibold tracking-[0.22em] text-red-500 uppercase" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
              DANCE
            </span>
          </div>
        </Link>

        <div className="w-20" />
      </nav>

      {/* EVENT HERO */}
      <div className="relative h-[220px] md:h-[260px] overflow-hidden bg-slate-900">
        <img
          src={evento.imagen_url || "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=1200&h=500&fit=crop&auto=format"}
          alt={evento.nombre}
          className="w-full h-full object-cover object-top opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/55 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 px-6 lg:px-10 pb-6 max-w-[1400px] mx-auto">
          <p className="text-red-500 text-xs font-semibold tracking-[0.3em] uppercase mb-2" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
            Galería del evento
          </p>
          <h1 className="text-3xl md:text-4xl font-black uppercase leading-tight text-white mb-3" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
            {evento.nombre}
          </h1>
          <div className="flex flex-wrap items-center gap-5 text-xs sm:text-sm text-slate-300">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-red-500" />
              {new Date(evento.fecha).toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-red-500" />
              {evento.lugar}
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-red-500" />
              {participantes.length} Participantes
            </span>
          </div>
        </div>
      </div>
      {/* FILTROS */}
      <div className="px-6 py-5 border-b border-slate-800/80 bg-[#131926]/60 sticky top-[72px] z-30 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, dorsal o academia..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-800 text-white text-sm pl-9 pr-4 py-2 rounded-xl focus:outline-none focus:border-red-500/60 placeholder:text-slate-500 transition-colors"
              />
            </div>

            {/* Select de Categoría */}
            <div className="relative flex-1 max-w-xl">
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="appearance-none bg-[#0B0F17] border border-slate-800 text-slate-200 text-sm pl-3 pr-8 py-2 rounded-xl focus:outline-none focus:border-red-500/60 transition-colors cursor-pointer min-w-[260px] font-medium"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#0B0F17]">
                    {cat === "Todos" ? "Categoría: Todas" : cat}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* TABLA DE PARTICIPANTE S */}
      <div className="px-6 lg:px-10 py-8">
        <div className="max-w-[1400px] mx-auto">
          <p className="text-xs text-slate-400 mb-4 tracking-wide font-medium">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-slate-500 bg-[#131926]/30 border border-slate-800/60 rounded-2xl">
              <Users size={44} className="mx-auto mb-3 opacity-40 text-slate-400" />
              <p className="text-slate-300 font-medium">No se encontraron participantes registrados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#131926]/30">
              <table className="w-full min-w-[1100px] text-sm text-left table-fixed">
                <thead>
                  <tr className="bg-[#131926] border-b border-slate-800">
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase w-[55px]">N°</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase w-[90px]">Orden</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase w-[25%]">Participante</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase w-[22%]">Academia</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase w-[38%]">Categoría</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map((participant, idx) => (
                    <tr
                      key={participant.id}
                      onClick={() => handleSelectParticipant(participant)}
                      className="group hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-red-500 font-bold whitespace-nowrap">
                        #{participant.dorsal_numero || "S/N"}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-white group-hover:text-red-500 transition-colors whitespace-nowrap">
                        {participant.nombre_completo}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                        {participant.academia ? (
                          <span className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-slate-500" />
                            {participant.academia}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">Independiente</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700/60 px-2.5 py-1 rounded-md leading-relaxed">
                            {participant.nombre_categoria}
                          </span>
                          {renderTipoBadge(participant.tipo_categoria)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-red-500 transition-colors inline-block" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}