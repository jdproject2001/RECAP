import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Camera, Video, ShoppingCart, Sparkles, Plus } from "lucide-react";
import { useCart } from "../context/cartContext"; // <-- Asumiendo que esta es tu ruta
import AuthModal from "../components/authModal";
import { API_BASE } from '../config/api';
import { auth } from "../firebase/firebase";

interface Evento {
  id: string;
  nombre: string;
  fecha: string;
  lugar: string;
}

interface ParticipanteDTO {
  id: string;
  nombre_completo: string;
  dorsal_numero: string;
  nombre_categoria: string;
  tipo_categoria?: 'SOLISTA' | 'DUO' | 'GRUPAL' | 'EQUIPO' | string;
  academia?: string;
}

interface PaqueteDTO {
  id: string;
  evento_id: string;
  nombre_paquete: string;
  descripcion?: string;
  precio: number | string;
  tipo: 'foto' | 'video' | 'combo';
  modalidad: 'SOLISTA_DUO' | 'GRUPAL' | 'TODOS' | string;
  cantidad_fotos?: number | null;
  tipo_formato?: string;
}

interface MultimediaDTO {
  id: string;
  tipo: 'FOTO' | 'VIDEO';
  activo: boolean;
  previewUrl: string | null;
}

const AVATAR_COLORS = [
  "bg-rose-800", "bg-violet-800", "bg-amber-800",
  "bg-teal-800", "bg-blue-800", "bg-indigo-800",
  "bg-emerald-800", "bg-orange-800",
];

function initials(name: string) {
  if (!name) return "??";
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export default function PackagesPage() {
  const { eventId, participantId } = useParams<{ eventId: string; participantId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart } = useCart(); // <-- Importamos la función del carrito
  const [showAuthModal, setShowAuthModal] = useState(false);

  const stateData = location.state as {
    participante?: ParticipanteDTO;
    evento?: Evento;
    paquetes?: PaqueteDTO[];
  } | null;

  const [evento, setEvento] = useState<Evento | null>(stateData?.evento || null);
  const [participante, setParticipante] = useState<ParticipanteDTO | null>(stateData?.participante || null);
  const [paquetesBD, setPaquetesBD] = useState<PaqueteDTO[]>(stateData?.paquetes || []);
  const [loading, setLoading] = useState(!stateData?.participante || !stateData?.evento);
  const [error, setError] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<'combo' | 'foto' | 'video'>('combo');
  const [selectedFotoPackageId, setSelectedFotoPackageId] = useState<string | null>(null);
  const [selectedComboPackageId, setSelectedComboPackageId] = useState<string | null>(null);

  const [multimediaDisponibles, setMultimediaDisponibles] = useState<MultimediaDTO[] | null>(null);
  const [, setCheckingMedia] = useState(false);
  const [pendingAction, setPendingAction] = useState<'ADD' | 'BUY' | null>(null);

  useEffect(() => {
    if (participante && evento && paquetesBD.length > 0) {
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/eventos/${eventId}/participantes/${participantId}`);
        if (!res.ok) throw new Error("No se pudo cargar la información del participante.");

        const data = await res.json();
        setEvento(data.evento || null);
        setParticipante(data.participante || null);
        setPaquetesBD(data.paquetes || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error al conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    };

    if (eventId && participantId) {
      fetchDetails();
    }
  }, [eventId, participantId]);

  const paquetesFoto = useMemo(() => {
    return paquetesBD
      .filter(
        (p) =>
          p.tipo.toLowerCase() === "foto"
      )
      .sort((a, b) => {
        const cantidadA =
          a.cantidad_fotos == null
            ? Number.MAX_SAFE_INTEGER
            : Number(a.cantidad_fotos);

        const cantidadB =
          b.cantidad_fotos == null
            ? Number.MAX_SAFE_INTEGER
            : Number(b.cantidad_fotos);

        return cantidadA - cantidadB;
      });
  }, [paquetesBD]);

  const paquetesVideo = useMemo(() => {
    return paquetesBD.filter((p) => p.tipo.toLowerCase() === "video");
  }, [paquetesBD]);

  const paquetesCombo = useMemo(() => {
    return paquetesBD
      .filter(
        (p) =>
          p.tipo.toLowerCase() === "combo"
      )
      .sort((a, b) => {
        const cantidadA =
          a.cantidad_fotos == null
            ? Number.MAX_SAFE_INTEGER
            : Number(a.cantidad_fotos);

        const cantidadB =
          b.cantidad_fotos == null
            ? Number.MAX_SAFE_INTEGER
            : Number(b.cantidad_fotos);

        return cantidadA - cantidadB;
      });
  }, [paquetesBD]);

  useEffect(() => {
    if (paquetesFoto.length > 0 && !selectedFotoPackageId) {
      setSelectedFotoPackageId(paquetesFoto[0].id);
    }
    if (paquetesCombo.length > 0 && !selectedComboPackageId) {
      setSelectedComboPackageId(paquetesCombo[0].id);
    }
  }, [paquetesFoto, paquetesCombo]);

  const activePackage = (() => {
    if (selectedType === 'combo') {
      return paquetesCombo.find(p => p.id === selectedComboPackageId) || paquetesCombo[0];
    }
    if (selectedType === 'foto') {
      return paquetesFoto.find(p => p.id === selectedFotoPackageId) || paquetesFoto[0];
    }
    return paquetesVideo[0];
  })();

  // ---- LÓGICA DE CARRITO Y COMPRA ----

  const obtenerMultimediaParticipante =
    async (): Promise<MultimediaDTO[]> => {

      // Si ya consultamos, no hacemos otra petición
      if (multimediaDisponibles !== null) {
        return multimediaDisponibles;
      }

      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error(
          'Debes iniciar sesión para continuar.'
        );
      }

      if (!participantId) {
        throw new Error(
          'No se encontró el participante.'
        );
      }

      setCheckingMedia(true);

      try {
        const token = await firebaseUser.getIdToken();

        const response = await fetch(
          `${API_BASE}/multimedia/participante/${participantId}`,
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
            'No se pudo consultar el material disponible.'
          );
        }

        const multimedia =
          (data.multimedia || []) as MultimediaDTO[];

        setMultimediaDisponibles(multimedia);

        return multimedia;

      } finally {
        setCheckingMedia(false);
      }
    };


  const tieneMaterialSuficiente = (
    paquete: PaqueteDTO,
    multimedia: MultimediaDTO[]
  ): boolean => {

    const fotos = multimedia.filter(
      item =>
        item.tipo === 'FOTO' &&
        item.activo &&
        !!item.previewUrl
    );

    const videos = multimedia.filter(
      item =>
        item.tipo === 'VIDEO' &&
        item.activo
    );

    const cantidadFotos =
      paquete.cantidad_fotos;

    // =====================================
    // SOLO VIDEO
    // =====================================

    if (paquete.tipo === 'video') {
      return videos.length >= 1;
    }

    // =====================================
    // SOLO FOTO
    // =====================================

    if (paquete.tipo === 'foto') {

      // NULL = ilimitadas
      if (cantidadFotos == null) {
        return fotos.length > 0;
      }

      // 0 = no debería existir
      // para un paquete solo foto
      if (cantidadFotos === 0) {
        return false;
      }

      return (
        fotos.length >= cantidadFotos
      );
    }

    // =====================================
    // COMBO
    // =====================================

    if (paquete.tipo === 'combo') {

      if (videos.length === 0) {
        return false;
      }

      // NULL = fotos ilimitadas
      // Debe existir al menos una foto.
      if (cantidadFotos == null) {
        return fotos.length > 0;
      }

      // 0 significaría combo sin fotos.
      if (cantidadFotos === 0) {
        return true;
      }

      return (
        fotos.length >= cantidadFotos
      );
    }

    return false;
  };


  const procesarPaquete = async (
    accion: 'ADD' | 'BUY'
  ) => {

    if (
      !activePackage ||
      !participante ||
      !eventId ||
      !participantId
    ) {
      return;
    }

    // Si no inició sesión guardamos lo que quería hacer
    if (!auth.currentUser) {
      setPendingAction(accion);
      setShowAuthModal(true);
      return;
    }

    try {
      setError(null);

      const multimedia =
        await obtenerMultimediaParticipante();

      const hayMaterial =
        tieneMaterialSuficiente(
          activePackage,
          multimedia
        );

      /*
       * COMPRA DIRECTA
       *
       * Existe suficiente material.
       * Todavía NO agregamos nada al carrito.
       * Primero debe escoger los archivos.
       */
      if (hayMaterial) {

        navigate(
          `/eventos/${eventId}/participantes/${participantId}/seleccionar-material`,
          {
            state: {
              paquete: {
                ...activePackage,
                descripcion:
                  activePackage.descripcion || '',
                precio:
                  Number(activePackage.precio),
                cantidad_fotos:
                  Number(
                    activePackage.cantidad_fotos
                  )
              },

              participante: {
                id: participante.id,
                nombre_completo:
                  participante.nombre_completo,
                dorsal_numero:
                  participante.dorsal_numero
              }
            }
          }
        );

        return;
      }


      /*
       * RESERVA
       *
       * Todavía no existe suficiente material.
       */
      const paqueteParaCarrito = {
        ...activePackage,
        descripcion:
          activePackage.descripcion || '',
        precio:
          Number(activePackage.precio),
        tipo:
          activePackage.tipo as
          | 'foto'
          | 'video'
          | 'combo'
      };

      addToCart(
        paqueteParaCarrito,
        participante,
        [],
        'RESERVA'
      );

      /*
       * "Comprar ahora" manda directamente
       * al carrito.
       *
       * "Añadir al carrito" permanece
       * en esta página.
       */
      if (accion === 'BUY') {
        navigate('/carrito');
      }
    } catch (err) {
      console.error(
        'Error procesando paquete:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar el paquete.'
      );
    }
  };

  const handleAddToCart = () => { void procesarPaquete('ADD'); };
  const handleBuyNow = () => { void procesarPaquete('BUY'); };

  const continuarDespuesDeLogin = () => {
    setShowAuthModal(false);
    if (!pendingAction) {
      return;
    }

    const accion = pendingAction;
    setPendingAction(null);
    void procesarPaquete(accion);
  };

  // ------------------------------------
  /*
    const proceedToCheckout = () => {
      navigate('/carrito');
    };*/
  // ------------------------------------

  const avatarColor = AVATAR_COLORS[Math.abs((participante?.nombre_completo || "").length) % AVATAR_COLORS.length];

  const renderTipoBadge = (tipo?: string) => {
    if (!tipo) return null;
    const t = tipo.toUpperCase();
    if (t === 'GRUPAL' || t === 'EQUIPO') {
      return <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded uppercase">Grupal</span>;
    }
    if (t === 'DUO') {
      return <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded uppercase">Dúo</span>;
    }
    return <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded uppercase">Solista</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D111C] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Cargando paquetes disponibles...</p>
        </div>
      </div>
    );
  }

  if (error || !evento || !participante) {
    return (
      <div className="min-h-screen bg-[#0D111C] flex items-center justify-center text-slate-400">
        <div className="text-center space-y-4">
          <p className="text-lg text-slate-300 font-medium">{error || "No se encontró la información."}</p>
          <button
            onClick={() => navigate(`/evento/${eventId}`)}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-500 transition-colors cursor-pointer"
          >
            Volver al evento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D111C] text-white">

      {/* SUB-BARRA "VOLVER" (Se queda pegada bajo el Navbar global h-20) */}
      <div className="sticky top-20 z-40 bg-[#0D111C]/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 transition-all">
        <div className="max-w-5xl mx-auto flex items-center">
          <button
            onClick={() => navigate(`/evento/${eventId}`)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Volver a la lista de participantes</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto">

          {/* CABECERA DEL PARTICIPANTE */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 p-6 bg-[#12131A] border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-5">
              <div
                className={`w-16 h-16 rounded-2xl ${avatarColor} flex items-center justify-center text-white text-xl font-black shrink-0 shadow-lg`}
                style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
              >
                {initials(participante.nombre_completo)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-red-500 font-bold tracking-[0.2em] uppercase" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                    {evento.nombre}
                  </span>
                  {renderTipoBadge(participante.tipo_categoria)}
                </div>
                <h1
                  className="text-3xl md:text-4xl font-black uppercase leading-tight text-white"
                  style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
                >
                  {participante.nombre_completo}
                </h1>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span>{participante.nombre_categoria}</span>
                  <span className="text-slate-600">•</span>
                  <span className="font-mono text-red-500 font-bold">Dorsal #{participante.dorsal_numero || "S/N"}</span>
                  {participante.academia && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span>{participante.academia}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold tracking-wide text-white uppercase" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
              Selecciona tu Paquete de Cobertura
            </h2>
          </div>

          {/* TARJETAS PRINCIPALES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* 1. TARJETA COMBO */}
            {paquetesCombo.length > 0 && (() => {
              const currentCombo = paquetesCombo.find(p => p.id === selectedComboPackageId) || paquetesCombo[0];
              const isSelected = selectedType === 'combo';

              return (
                <div
                  onClick={() => setSelectedType('combo')}
                  className={`relative flex flex-col rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden bg-[#12131A] ${isSelected ? "border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.2)] -translate-y-1" : "border-slate-800 hover:border-slate-700 hover:-translate-y-0.5"
                    }`}
                >
                  <div className="bg-red-600/10 border-b border-red-500/20 px-4 py-1.5 flex items-center gap-1.5 text-[11px] font-bold text-red-400 uppercase tracking-wider">
                    <Sparkles size={13} /> MÁS POPULAR
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-1 text-red-500 mb-3">
                      <Camera size={18} /><span className="text-xs font-bold">+</span><Video size={18} />
                    </div>
                    <h3 className="text-2xl font-black uppercase mb-2 text-white tracking-wide" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                      FOTO + VIDEO
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      {currentCombo.descripcion || "Recibe tus mejores momentos en foto y el video completo de tu presentación."}
                    </p>

                    {paquetesCombo.some(p => p.cantidad_fotos && p.cantidad_fotos > 0) && (
                      <div className="mb-6" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-2">Cantidad de fotos</p>
                        <div className="flex gap-2">
                          {paquetesCombo.map((pkg) => (
                            <button
                              key={pkg.id} type="button"
                              onClick={() => { setSelectedType('combo'); setSelectedComboPackageId(pkg.id); }}
                              className={`flex-1 py-1.5 rounded-lg text-sm font-black border transition-all cursor-pointer ${selectedComboPackageId === pkg.id ? "bg-red-600 border-red-600 text-white shadow-md shadow-red-600/20" : "bg-[#181a24] border-[#262938] text-slate-300 hover:border-slate-500"
                                }`}
                              style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
                            >
                              {pkg.cantidad_fotos == null
                                ? 'ILIMITADAS'
                                : `${pkg.cantidad_fotos} FOTOS`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-slate-800">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black text-white" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                          ${Number(currentCombo.precio).toFixed(2)}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">USD</span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-6 py-3.5 border-t text-center text-xs font-bold uppercase tracking-wider transition-colors ${isSelected ? "bg-red-600 border-red-600 text-white" : "border-slate-800 text-slate-400 bg-[#0e0f14]"}`} style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                    {isSelected ? "Seleccionado" : "Seleccionar"}
                  </div>
                </div>
              );
            })()}

            {/* 2. TARJETA SOLO FOTO */}
            {paquetesFoto.length > 0 && (() => {
              const currentFoto = paquetesFoto.find(p => p.id === selectedFotoPackageId) || paquetesFoto[0];
              const isSelected = selectedType === 'foto';

              return (
                <div
                  onClick={() => setSelectedType('foto')}
                  className={`relative flex flex-col rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden bg-[#12131A] ${isSelected ? "border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.2)] -translate-y-1" : "border-slate-800 hover:border-slate-700 hover:-translate-y-0.5"
                    }`}
                >
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="text-red-500 mb-3"><Camera size={18} /></div>
                    <h3 className="text-2xl font-black uppercase mb-2 text-white tracking-wide" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>SOLO FOTO</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">{currentFoto.descripcion || "Las mejores capturas de tu baile, editadas y listas para compartir."}</p>

                    <div className="mb-6" onClick={(e) => e.stopPropagation()}>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-2">Cantidad de fotos</p>
                      <div className="flex gap-2">
                        {paquetesFoto.map((pkg) => (
                          <button
                            key={pkg.id} type="button"
                            onClick={() => { setSelectedType('foto'); setSelectedFotoPackageId(pkg.id); }}
                            className={`flex-1 py-1.5 rounded-lg text-base font-black border transition-all cursor-pointer ${selectedFotoPackageId === pkg.id ? "bg-red-600 border-red-600 text-white shadow-md shadow-red-600/20" : "bg-[#181a24] border-[#262938] text-slate-300 hover:border-slate-500"
                              }`}
                            style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
                          >
                            {pkg.cantidad_fotos || pkg.nombre_paquete.replace(/\D/g, "") || "1"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-800">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black text-white" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>${Number(currentFoto.precio).toFixed(2)}</span>
                        <span className="text-xs font-semibold text-slate-400">USD</span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-6 py-3.5 border-t text-center text-xs font-bold uppercase tracking-wider transition-colors ${isSelected ? "bg-red-600 border-red-600 text-white" : "border-slate-800 text-slate-400 bg-[#0e0f14]"}`} style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                    {isSelected ? "Seleccionado" : "Seleccionar"}
                  </div>
                </div>
              );
            })()}

            {/* 3. TARJETA SOLO VIDEO */}
            {paquetesVideo.length > 0 && (() => {
              const currentVideo = paquetesVideo[0];
              const isSelected = selectedType === 'video';

              return (
                <div
                  onClick={() => setSelectedType('video')}
                  className={`relative flex flex-col rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden bg-[#12131A] ${isSelected ? "border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.2)] -translate-y-1" : "border-slate-800 hover:border-slate-700 hover:-translate-y-0.5"
                    }`}
                >
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="text-red-500 mb-3"><Video size={18} /></div>
                    <h3 className="text-2xl font-black uppercase mb-2 text-white tracking-wide" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>SOLO VIDEO</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">{currentVideo.descripcion || "Tu actuación completa en video en calidad HD."}</p>

                    <div className="mt-auto pt-4 border-t border-slate-800">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black text-white" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>${Number(currentVideo.precio).toFixed(2)}</span>
                        <span className="text-xs font-semibold text-slate-400">USD</span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-6 py-3.5 border-t text-center text-xs font-bold uppercase tracking-wider transition-colors ${isSelected ? "bg-red-600 border-red-600 text-white" : "border-slate-800 text-slate-400 bg-[#0e0f14]"}`} style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                    {isSelected ? "Seleccionado" : "Seleccionar"}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* BARRA INFERIOR DE RESUMEN Y ACCIONES DE COMPRA */}
          {activePackage && (
            <div className="sticky bottom-6 bg-[#12131A] border border-red-600/40 rounded-2xl px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_8px_30px_rgba(0,0,0,0.8)] backdrop-blur-md">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Paquete seleccionado</p>
                <p className="font-bold text-white uppercase text-lg" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                  {selectedType === 'combo' ? 'FOTO + VIDEO' : selectedType === 'foto' ? 'SOLO FOTO' : 'SOLO VIDEO'}
                  {activePackage.tipo !== 'video' && (
                    <span className="text-slate-400 font-normal ml-2 text-sm normal-case">
                      {activePackage.cantidad_fotos == null
                        ? '— fotos ilimitadas'
                        : activePackage.cantidad_fotos > 0
                          ? `— ${activePackage.cantidad_fotos} fotos`
                          : ''}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                <span className="text-3xl font-black text-red-500 whitespace-nowrap" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                  ${Number(activePackage.precio).toFixed(2)} USD
                </span>

                {/* BOTONES DUALES DE CARRITO */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#1a1f2e] border border-slate-700 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                  >
                    <Plus size={16} />
                    Añadir al carrito
                  </button>
                  <button
                    onClick={handleBuyNow}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-red-500 transition-colors cursor-pointer uppercase tracking-wider shadow-lg shadow-red-600/30"
                    style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
                  >
                    <ShoppingCart size={16} />
                    Comprar Ahora
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingAction(null);
        }}
        onSuccess={continuarDespuesDeLogin}
      />
    </div>
  );
}