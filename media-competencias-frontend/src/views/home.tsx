import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 1. Definimos la interfaz del Evento
interface Evento {
    id: string;
    nombre: string;
    fecha: string;
    lugar: string;
    activo: boolean;
    imagen_url?: string;
}

interface HomeProps {
    onNavigateToCatalog?: () => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigateToCatalog }) => {
    const navigate = useNavigate();
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busquedaEvento, setBusquedaEvento] = useState('');

    // Fetch de eventos desde el backend
    useEffect(() => {
        const obtenerEventos = async () => {
            try {
                setLoading(true);
                const respuesta = await fetch('http://localhost:4000/api/v1/eventos');

                if (!respuesta.ok) {
                    throw new Error('No se pudieron recuperar los eventos desde el servidor');
                }

                const data = await respuesta.json();
                
                // Filtrar eventos activos
                const eventosActivos = data.filter((ev: Evento) => {
                    return ev.activo === true || String(ev.activo).toLowerCase() === 'true' || Number(ev.activo) === 1;
                });
                
                setEventos(eventosActivos);
            } catch (err: any) {
                setError(err.message || 'Error al conectar con la base de datos');
            } finally {
                setLoading(false);
            }
        };

        obtenerEventos();
    }, []);

    // Lógica del buscador
    const eventosFiltrados = eventos.filter((evento) => {
        const termino = busquedaEvento.toLowerCase();
        return (
            evento.nombre.toLowerCase().includes(termino) ||
            evento.lugar.toLowerCase().includes(termino)
        );
    });

    const handleSelectEvento = (eventoId: string) => {
        // Redirige dinámicamente al detalle del evento seleccionado
        navigate(`/evento/${eventoId}`);
        if (onNavigateToCatalog) {
            onNavigateToCatalog();
        }
    };

    return (
        <div className="bg-[#0D111C] text-[#E2E8F0] min-h-screen font-sans selection:bg-red-600/30 selection:text-white antialiased scroll-smooth">

            {/* NAVBAR SUPERIOR MINIMALISTA 
            <nav className="border-b border-slate-800/60 bg-[#0D111C]/80 backdrop-blur-md sticky top-0 z-50 transition-all">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    {/* LOGO RECAP DANCE 
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="flex flex-col leading-none">
                            <span
                                className="text-lg font-black text-white uppercase"
                                style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '0.18em' }}
                            >
                                RECAP
                            </span>
                            <span
                                className="text-[10px] font-semibold text-red-500 uppercase"
                                style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '0.22em' }}
                            >
                                DANCE
                            </span>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
                        <a href="#" className="text-white hover:text-red-400 transition-colors">Inicio</a>
                        <a href="#eventos" className="hover:text-white hover:text-red-400 transition-colors">Eventos</a>
                        <a href="#quienes-somos" className="hover:text-white hover:text-red-400 transition-colors">Quiénes Somos</a>
                    </div>

                    {/* BOTONES DE AUTENTICACIÓN 
                    <div className="flex items-center gap-3">
                        <button className="text-sm px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer font-medium">
                            Iniciar sesión
                        </button>
                        <button className="text-sm px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-colors font-semibold shadow-md shadow-red-600/10 cursor-pointer">
                            Crear cuenta
                        </button>
                    </div>
                </div>
            </nav>*/}

            {/* 1. HERO SECTION */}
            <section className="relative min-h-[85vh] flex items-center justify-center px-6 overflow-hidden">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-10 right-10 w-80 h-80 bg-fuchsia-600/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-4xl mx-auto text-center z-10 space-y-8">
                    <div className="inline-flex items-center bg-slate-900 border border-slate-800 text-red-400 text-[11px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                        Producción Audiovisual Profesional
                    </div>

                    <h1
                        className="text-5xl sm:text-7xl md:text-8xl font-black leading-none uppercase mb-6 italic tracking-wide"
                        style={{ fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '0.02em' }}
                    >
                        <span className="block text-white">Tu baile,</span>
                        <span className="block text-white">tu momento,</span>
                        <span className="block bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text text-transparent">
                            tu video.
                        </span>
                    </h1>

                    <div className="inline-flex items-center justify-center gap-3 mb-8">
                        <div className="h-px w-12 bg-red-500/60"></div>
                        <span
                            className="text-xl font-bold tracking-[0.25em] text-slate-300 uppercase"
                            style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
                        >
                            RECAP DANCE
                        </span>
                        <div className="h-px w-12 bg-red-500/60"></div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a
                            href="#eventos"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 text-white px-7 py-4 rounded-xl font-semibold text-xs tracking-widest uppercase hover:bg-red-500 transition-all hover:scale-105 duration-300 text-center shadow-lg shadow-red-600/20"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play">
                                <polygon points="6 3 20 12 6 21 6 3"></polygon>
                            </svg>
                            Ver mis fotos y videos
                        </a>
                        <a
                            href="#quienes-somos"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#131926]/40 border border-slate-800/80 text-slate-300 hover:text-white hover:border-red-600/50 px-7 py-4 rounded-xl font-semibold text-xs tracking-widest uppercase transition-all duration-300 hover:scale-105 text-center shadow-inner shadow-black/10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-camera">
                                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                                <circle cx="12" cy="13" r="3"></circle>
                            </svg>
                            Conocer más
                        </a>
                    </div>
                </div>
            </section>

            {/* 2. SECCIÓN DE EVENTOS CON BUSCADOR */}
            <section id="eventos" className="max-w-6xl mx-auto px-6 py-24 scroll-mt-20">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                    <div className="space-y-2">
                        <span className="text-xs font-bold text-red-500 uppercase tracking-widest block">GALERÍA DE EVENTOS</span>
                        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">ENCUENTRA TU EVENTO</h2>
                    </div>

                    <div className="w-full max-w-md relative group">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500 group-focus-within:text-red-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar evento por nombre o ciudad..."
                            value={busquedaEvento}
                            onChange={(e) => setBusquedaEvento(e.target.value)}
                            className="w-full bg-[#131926]/60 text-slate-200 placeholder-slate-500 text-sm pl-11 pr-10 py-3.5 rounded-xl border border-slate-800/80 focus:border-red-500/50 focus:bg-[#131926] outline-none transition-all duration-300 font-medium shadow-inner shadow-black/10"
                        />
                        {busquedaEvento && (
                            <button
                                onClick={() => setBusquedaEvento('')}
                                className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* ESTADOS DE CARGA Y ERRORES */}
                {loading && (
                    <div className="text-center py-12 text-slate-400 text-sm animate-pulse">
                        ⌛ Cargando eventos...
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm text-center max-w-md mx-auto">
                        No se pudo conectar con el servidor: {error}
                    </div>
                )}

                {!loading && !error && eventosFiltrados.length === 0 && (
                    <div className="text-center py-12 text-slate-500 text-sm">
                        No encontramos eventos para "{busquedaEvento}"
                    </div>
                )}

                {/* GRID DE TARJETAS */}
                {!loading && !error && eventosFiltrados.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {eventosFiltrados.map((evento) => (
                            <article
                                key={evento.id}
                                onClick={() => handleSelectEvento(evento.id)}
                                className="group relative bg-[#131926]/40 border border-slate-800/80 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer hover:border-red-500/40 hover:-translate-y-1 hover:shadow-[0_8px_40px_rgba(220,38,38,0.15)] hover:bg-[#131926]/80"
                            >
                                <div className="relative overflow-hidden h-52 bg-slate-900">
                                    <img
                                        src={evento.imagen_url || "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=1200&h=500&fit=crop&auto=format"}
                                        alt={evento.nombre}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#131926] via-[#131926]/20 to-transparent"></div>
                                </div>

                                <div className="p-5">
                                    <h3
                                        className="text-lg font-bold uppercase leading-tight mb-1 text-white group-hover:text-red-500 transition-colors"
                                        style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
                                    >
                                        {evento.nombre}
                                    </h3>

                                    <p className="text-xs text-slate-400 mb-4">
                                        Competencia / Cobertura de Video
                                    </p>

                                    <div className="flex items-center gap-4 text-xs text-slate-400">
                                        <span className="flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar text-red-500/80">
                                                <path d="M8 2v4"></path>
                                                <path d="M16 2v4"></path>
                                                <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                                                <path d="M3 10h18"></path>
                                            </svg>
                                            {new Date(evento.fecha).toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>

                                        <span className="flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin text-red-500/80">
                                                <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path>
                                                <circle cx="12" cy="10" r="3"></circle>
                                            </svg>
                                            {evento.lugar}
                                        </span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            {/* 3. SECCIÓN QUIÉNES SOMOS */}
            <section id="quienes-somos" className="border-t border-slate-800/50 bg-[#0A0D14] py-24 scroll-mt-20">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <span className="text-xs font-bold text-red-500 uppercase tracking-widest block">QUIÉNES SOMOS</span>
                            <h2
                                className="text-3xl md:text-4xl font-black uppercase leading-tight mb-6 text-white"
                                style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
                            >
                                Capturamos cada{' '}
                                <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                                    paso,
                                </span>{' '}
                                cada{' '}
                                <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                                    instante.
                                </span>
                            </h2>
                        </div>

                        <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-medium">
                            Somos un equipo técnico y creativo comprometido con transformar cada competencia en una obra cinematográfica. Nos ubicamos en las secciones más demandantes de la ruta para registrar la verdadera intensidad del atleta.
                        </p>

                        <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-medium">
                            Utilizamos cámaras de última generación, ópticas de largo alcance y sistemas de rastreo digital para asegurar que encuentres tus archivos multimedia de forma rápida y automatizada.
                        </p>

                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <div className="border border-slate-800/80 bg-[#131926]/40 p-5 rounded-xl">
                                <p className="text-3xl font-black text-white mb-1">4K</p>
                                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Resolución Máxima</p>
                            </div>
                            <div className="border border-slate-800/80 bg-[#131926]/40 p-5 rounded-xl">
                                <p className="text-3xl font-black text-white mb-1">24h</p>
                                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Procesado de Entrega</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative aspect-video md:aspect-square bg-[#131926] rounded-2xl border border-slate-800 flex items-center justify-center shadow-xl group overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=800')] bg-cover bg-center mix-blend-overlay opacity-20 grayscale group-hover:scale-105 transition-transform duration-500" />
                        <div className="z-10 w-16 h-16 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 shadow-2xl group-hover:bg-red-600 group-hover:border-red-500 transition-all duration-300 cursor-pointer">
                            <span className="text-white text-xl translate-x-0.5">▶</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};