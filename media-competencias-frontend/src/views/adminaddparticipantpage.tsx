import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, CheckCircle2, AlertCircle, Building2, Tag, Hash, User } from "lucide-react";
import { API_BASE } from '../config/api';

interface Categoria {
  id: string;
  nombre_categoria: string;
  tipo_categoria?: string;
}

export default function AdminAddParticipantPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  // Estados de datos
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  // Estados del Formulario
  const [categoriaId, setCategoriaId] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [dorsalNumero, setDorsalNumero] = useState("");
  const [academia, setAcademia] = useState("");

  // Estados de interfaz
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Cargar las categorías del evento desde la base de datos
  useEffect(() => {
  if (!eventId) return;

  const fetchCategorias = async () => {
    try {
      setLoadingCats(true);
      setErrorMsg(null);

      const res = await fetch(`${API_BASE}/eventos/${eventId}/categorias`);
      if (!res.ok) throw new Error("No se pudieron cargar las categorías del evento");
      
      const data: Categoria[] = await res.json();
      setCategorias(data);
      
      // Seleccionar por defecto la primera categoría del listado
      if (data.length > 0) {
        setCategoriaId(data[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al obtener las categorías");
    } finally {
      setLoadingCats(false);
    }
  };

  fetchCategorias();
}, [eventId]);

  // 2. Enviar el participante a la API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!categoriaId || !nombreCompleto.trim()) {
      setErrorMsg("Por favor selecciona una categoría e ingresa el nombre del participante.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_BASE}/participantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria_id: categoriaId,
          nombre_completo: nombreCompleto.trim(),
          dorsal_numero: dorsalNumero.trim(),
          academia: academia.trim()
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error al guardar participante");
      }

      setSuccessMsg(`¡Participante "${nombreCompleto}" registrado con éxito!`);
      
      // Limpiar campos para ingreso rápido del siguiente competidor
      setNombreCompleto("");
      setDorsalNumero("");
      // Mantenemos la categoría y la academia por si se ingresan varios seguidos de la misma academia/categoría
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white p-6 flex flex-col items-center">
      {/* Botón Volver */}
      <div className="w-full max-w-xl mb-6">
        <button
          onClick={() => navigate(`/evento/${eventId}`)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          <span>Volver al Evento</span>
        </button>
      </div>

      <div className="w-full max-w-xl bg-[#131926] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <div className="p-3 bg-red-600/10 text-red-500 rounded-xl border border-red-500/20">
            <UserPlus size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-white">
              Carga de Participantes
            </h1>
            <p className="text-xs text-slate-400">
              Asigna participantes a sus categorías de forma rápida.
            </p>
          </div>
        </div>

        {/* Mensaje de Éxito */}
        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Categoría Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
              <Tag size={14} className="text-red-500" />
              Categoría
            </label>
            {loadingCats ? (
              <div className="text-xs text-slate-500 py-2">Cargando categorías...</div>
            ) : (
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-800 text-white text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
                required
              >
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre_categoria} {cat.tipo_categoria ? `(${cat.tipo_categoria})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Nombre Completo */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
              <User size={14} className="text-red-500" />
              Nombre del Participante / Nombre del Grupo
            </label>
            <input
              type="text"
              placeholder="Ej: Andrea Yanqui o Bachateritas (5 personas)"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              className="w-full bg-[#0B0F17] border border-slate-800 text-white text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-red-500 transition-colors placeholder:text-slate-600"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dorsal Número */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                <Hash size={14} className="text-red-500" />
                Dorsal / N° Competidor
              </label>
              <input
                type="text"
                placeholder="Ej: 10"
                value={dorsalNumero}
                onChange={(e) => setDorsalNumero(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-800 text-white text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-red-500 transition-colors placeholder:text-slate-600 font-mono"
              />
            </div>

            {/* Academia */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                <Building2 size={14} className="text-red-500" />
                Academia / Estudio
              </label>
              <input
                type="text"
                placeholder="Ej: WEPA Academia de Baile"
                value={academia}
                onChange={(e) => setAcademia(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-800 text-white text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-red-500 transition-colors placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Botón de envío */}
          <button
            type="submit"
            disabled={isSubmitting || loadingCats}
            className="w-full mt-4 bg-red-600 hover:bg-red-500 text-white text-sm font-bold uppercase py-3.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
          >
            {isSubmitting ? "Guardando..." : "Guardar Participante"}
          </button>
        </form>
      </div>
    </div>
  );
}