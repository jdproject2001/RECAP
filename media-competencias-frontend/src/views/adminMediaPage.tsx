import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, FileVideo, Loader2, Upload, X, XCircle } from 'lucide-react';
import { API_BASE } from '../config/api';
import { auth } from '../firebase/firebase';

interface Evento {
    id: string;
    nombre: string;
    fecha: string;
    lugar: string;
}

interface Participante {
    id: string;
    nombre_completo: string;
    dorsal_numero: string;
    nombre_categoria?: string;
    tipo_categoria?: string;
    academia?: string;
    categoria_id?: string;
}

interface UploadItem {
    id: string;
    file: File;
    status:
    | 'PENDIENTE'
    | 'SUBIENDO'
    | 'CONFIRMANDO'
    | 'COMPLETADO'
    | 'ERROR';
    error?: string;
}

export default function AdminMediaPage() {
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [participantes, setParticipantes] = useState<Participante[]>([]);
    const [eventoId, setEventoId] = useState('');
    const [participanteId, setParticipanteId] = useState('');
    const [fotos, setFotos] = useState<UploadItem[]>([]);
    const [video, setVideo] = useState<UploadItem | null>(null);
    const [loadingEventos, setLoadingEventos] = useState(true);
    const [, setLoadingParticipantes] = useState(false);
    const [subiendoFotos, setSubiendoFotos] = useState(false);
    const [subiendoVideo, setSubiendoVideo] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busquedaParticipante, setBusquedaParticipante] = useState('');
    const [categoriaSeleccionada, setCategoriaSeleccionada] =useState('');

    // ======================================================
    // CARGAR EVENTOS
    // ======================================================

    useEffect(() => {
        const cargarEventos = async () => {
            try {
                setLoadingEventos(true);
                const response = await fetch(`${API_BASE}/eventos`);
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(
                        data.error || 'No se pudieron cargar los eventos.'
                    );
                }
                setEventos(data);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Error cargando eventos.'
                );
            } finally {
                setLoadingEventos(false);
            }
        };

        cargarEventos();
    }, []);

    // ======================================================
    // CARGAR PARTICIPANTES DEL EVENTO
    // ======================================================

    const categoriasDisponibles = useMemo(() => {
        const mapa = new Map<string, string>();
        participantes.forEach((p) => {
            if (
            p.categoria_id &&
            p.nombre_categoria
            ) {
            mapa.set(
                p.categoria_id,
                p.nombre_categoria
            );
            }
        });

        return Array.from(
            mapa.entries()
        ).map(([id, nombre]) => ({
            id,
            nombre
        }));

        }, [participantes]
    );

    const participantesFiltrados = useMemo(() => {
        const texto = busquedaParticipante.trim().toLowerCase();
        return participantes.filter((p) => {
            const coincideCategoria = !categoriaSeleccionada || p.categoria_id === categoriaSeleccionada;
            if (!coincideCategoria) {
                return false;
            }
            if (!texto) {
                return true;
            }

            const nombre = p.nombre_completo?.toLowerCase() || '';
            const dorsal = p.dorsal_numero?.toString().toLowerCase() || '';
            const academia = p.academia?.toLowerCase() || '';
            return (
                nombre.includes(texto) ||
                dorsal.includes(texto) ||
                academia.includes(texto)
            );
        });
        }, [
            participantes,
            busquedaParticipante,
            categoriaSeleccionada
        ]
    );

    useEffect(() => {
        if (!eventoId) {
            setParticipantes([]);
            setParticipanteId('');
            return;
        }

        const cargarParticipantes = async () => {
            try {
                setLoadingParticipantes(true);
                setParticipanteId('');
                setParticipantes([]);

                const response = await fetch(`${API_BASE}/eventos/${eventoId}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.error ||
                        'No se pudieron cargar los participantes.'
                    );
                }

                setParticipantes(data.participantes || []);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Error cargando participantes.'
                );
            } finally {
                setLoadingParticipantes(false);
            }
        };

        cargarParticipantes();
    }, [eventoId]);

    // ======================================================
    // SELECCIONAR FOTOS
    // ======================================================

    const handleSeleccionarFotos = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const files = Array.from(event.target.files || []);
        const nuevasFotos: UploadItem[] = files.map((file) => ({
            id: `${file.name}-${file.size}-${file.lastModified}`,
            file,
            status: 'PENDIENTE'
        }));

        setFotos(nuevasFotos);
    };

    // ======================================================
    // SELECCIONAR VIDEO
    // ======================================================

    const handleSeleccionarVideo = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) {
            setVideo(null);
            return;
        }
        setVideo({
            id: `${file.name}-${file.size}-${file.lastModified}`,
            file,
            status: 'PENDIENTE'
        });
    };

    // ======================================================
    // ACTUALIZAR FOTO
    // ======================================================

    const actualizarFoto = (
        id: string,
        cambios: Partial<UploadItem>
    ) => {
        setFotos((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        ...cambios
                    }
                    : item
            )
        );
    };

    // ======================================================
    // SUBIR UN ARCHIVO
    // ======================================================

    const subirArchivo = async (
        item: UploadItem,
        tipo: 'foto' | 'video'
    ) => {
        if (!participanteId) {
            throw new Error(
                'Debes seleccionar un participante.'
            );
        }

        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            throw new Error(
                'Debes iniciar sesión como administrador o técnico.'
            );
        }

        const token = await firebaseUser.getIdToken();

        // ------------------------------------------
        // 1. PEDIR URL FIRMADA
        // ------------------------------------------

        const uploadUrlResponse = await fetch(
            `${API_BASE}/multimedia/upload-url`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    participanteId,
                    tipo,
                    nombreArchivo: item.file.name,
                    mimeType: item.file.type
                })
            }
        );

        const uploadUrlData =
            await uploadUrlResponse.json();

        if (!uploadUrlResponse.ok) {
            throw new Error(
                uploadUrlData.error ||
                'No se pudo generar la URL de subida.'
            );
        }

        /*
         * Ajusta estos nombres si tu endpoint devuelve
         * propiedades diferentes.
         */
        const uploadUrl = uploadUrlData.uploadUrl || uploadUrlData.url;
        const r2Key = uploadUrlData.r2Key || uploadUrlData.key;

        if (!uploadUrl || !r2Key) {
            console.error('RESPUESTA upload-url:', uploadUrlData);
            throw new Error(
                'El backend no devolvió uploadUrl o r2Key.'
            );
        }

        // ------------------------------------------
        // 2. SUBIR DIRECTAMENTE A R2
        // ------------------------------------------

        const r2Response = await fetch(
            uploadUrl,
            {
                method: 'PUT',
                headers: {
                    'Content-Type':
                        item.file.type ||
                        'application/octet-stream'
                },
                body: item.file
            }
        );

        if (!r2Response.ok) {
            const responseText =
                await r2Response.text();

            console.error('ERROR R2:', responseText);
            throw new Error(
                'No se pudo subir el archivo a Cloudflare R2.'
            );
        }

        // ------------------------------------------
        // 3. CONFIRMAR EN BACKEND
        // ------------------------------------------

        const confirmResponse = await fetch(
            `${API_BASE}/multimedia/confirm-upload`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    participanteId,
                    tipo,
                    nombreArchivo: item.file.name,
                    mimeType: item.file.type,
                    r2Key
                })
            }
        );

        const confirmData =
            await confirmResponse.json();

        if (!confirmResponse.ok) {
            throw new Error(
                confirmData.error ||
                'No se pudo confirmar el archivo.'
            );
        }

        return confirmData;
    };

    const eliminarFoto = (id: string) => {
        setFotos((prev) => prev.filter((item) => item.id !== id));
    };

    // ======================================================
    // SUBIR TODAS LAS FOTOS
    // ======================================================

    const handleSubirFotos = async () => {
        if (!participanteId) {
            setError('Debes seleccionar un participante.');
            return;
        }

        if (fotos.length === 0) {
            setError('Debes seleccionar al menos una fotografía.');
            return;
        }

        try {
            setError(null);
            setSubiendoFotos(true);

            /*
             * Primera versión:
             * procesamiento secuencial.
             *
             * Es más lento que paralelo,
             * pero evita saturar Sharp/backend mientras
             * validamos el flujo.
             */
            for (const foto of fotos) {
                try {
                    actualizarFoto(foto.id, {
                        status: 'SUBIENDO',
                        error: undefined
                    });
                    await subirArchivo(foto, 'foto');
                    actualizarFoto(foto.id, { status: 'COMPLETADO' });
                } catch (err) {
                    actualizarFoto(foto.id, {
                        status: 'ERROR',
                        error:
                            err instanceof Error
                                ? err.message
                                : 'Error desconocido'
                    });
                }
            }
        } finally {
            setSubiendoFotos(false);
        }
    };

    // ======================================================
    // SUBIR VIDEO
    // ======================================================

    const handleSubirVideo = async () => {
        if (!participanteId) {
            setError('Debes seleccionar un participante.');
            return;
        }
        if (!video) {
            setError('Debes seleccionar un video.');
            return;
        }
        try {
            setError(null);
            setSubiendoVideo(true);
            setVideo((prev) =>
                prev
                    ? {
                        ...prev,
                        status: 'SUBIENDO',
                        error: undefined
                    }
                    : null
            );
            await subirArchivo(video, 'video');
            setVideo((prev) =>
                prev
                    ? {
                        ...prev,
                        status: 'COMPLETADO'
                    }
                    : null
            );
        } catch (err) {
            setVideo((prev) =>
                prev
                    ? {
                        ...prev,
                        status: 'ERROR',
                        error:
                            err instanceof Error
                                ? err.message
                                : 'Error desconocido'
                    }
                    : null
            );
        } finally {
            setSubiendoVideo(false);
        }
    };

    // ======================================================
    // CONTADORES
    // ======================================================

    const fotosCompletadas = useMemo(
        () => fotos.filter((item) => item.status === 'COMPLETADO').length, [fotos]
    );
    const todasLasFotosCompletadas = fotos.length > 0 && fotosCompletadas === fotos.length;
    const fotosError = useMemo(
        () => fotos.filter((item) => item.status === 'ERROR').length, [fotos]
    );

    return (
        <div className="min-h-screen bg-[#0D111C] text-white pt-24 pb-16">
            <div className="max-w-5xl mx-auto px-6">
                <div className="mb-8">
                    <p className="text-red-500 font-bold text-xs uppercase tracking-[0.2em] mb-2">Gestión multimedia</p>
                    <h1 className="text-4xl font-black uppercase" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>Carga de fotografías y videos</h1>
                    <p className="text-slate-400 mt-2 text-sm">Selecciona el evento y participante al que pertenece el material.</p>
                </div>
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">{error}</div>
                )}

                {/* ============================================== */}
                {/* SELECCIÓN PARTICIPANTE */}
                {/* ============================================== */}

                <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-6 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Evento</label>
                            <select
                                value={eventoId}
                                onChange={(e) => {
                                    setEventoId(e.target.value);
                                    setParticipanteId('');
                                    setFotos([]);
                                    setVideo(null);
                                }}
                                disabled={loadingEventos}
                                className="w-full bg-[#181A24] border border-slate-700 rounded-xl p-3 text-sm text-white"
                            >
                                <option value="">Selecciona un evento</option>
                                {eventos.map((evento) => (
                                    <option
                                        key={evento.id}
                                        value={evento.id}
                                    >
                                        {evento.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Buscar participante</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                <select
                                value={categoriaSeleccionada}
                                onChange={(e) => {
                                    setCategoriaSeleccionada(
                                    e.target.value
                                    );
                                    setParticipanteId('');
                                }}
                                disabled={!eventoId}
                                className="bg-[#181A24] border border-slate-700 rounded-xl p-3 text-sm text-white"
                                >
                                <option value="">Todas las categorías</option>
                                {categoriasDisponibles.map(
                                    (categoria) => (
                                    <option
                                        key={categoria.id}
                                        value={categoria.id}
                                    >
                                        {categoria.nombre}
                                    </option>
                                    )
                                )}
                                </select>
                                <input
                                type="text"
                                value={busquedaParticipante}
                                onChange={(e) =>
                                    setBusquedaParticipante(
                                    e.target.value
                                    )
                                }
                                disabled={!eventoId}
                                placeholder="Nombre, dorsal o academia..."
                                className="md:col-span-2 bg-[#181A24] border border-slate-700 rounded-xl p-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                                />
                            </div>
                            {eventoId && (
                                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                                {participantesFiltrados.length === 0 ? (
                                    <div className="text-center text-slate-500 py-8 bg-[#181A24] rounded-xl">No se encontraron participantes.</div>
                                ) : (
                                    participantesFiltrados.map(
                                    (participante) => {
                                        const seleccionado = participante.id === participanteId;
                                        return (
                                        <button
                                            key={participante.id}
                                            type="button"
                                            onClick={() => {
                                            setParticipanteId(
                                                participante.id
                                            );

                                            setFotos([]);
                                            setVideo(null);
                                            }}
                                            className={`w-full text-left p-4 rounded-xl border transition-colors ${
                                            seleccionado
                                                ? 'border-red-500 bg-red-500/10'
                                                : 'border-slate-800 bg-[#181A24] hover:border-slate-600'
                                            }`}
                                        >
                                            <div className="flex justify-between gap-4">
                                            <div>
                                                <p className="font-bold text-white">
                                                {participante.nombre_completo}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                {participante.nombre_categoria || 'Sin categoría'}
                                                {participante.academia &&
                                                    ` · ${participante.academia}`}
                                                </p>
                                            </div>
                                            <span className="font-mono text-red-400 text-sm">
                                                #{participante.dorsal_numero || 'S/N'}
                                            </span>

                                            </div>
                                        </button>
                                        );
                                    }
                                    )
                                )}
                                </div>
                            )}
                            </div>
                    </div>
                </div>

                {/* ============================================== */}
                {/* FOTOS */}
                {/* ============================================== */}

                <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-11 h-11 bg-red-500/10 rounded-xl flex items-center justify-center">
                            <Camera className="text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold uppercase">Fotografías</h2>
                            <p className="text-xs text-slate-400">Puedes seleccionar múltiples fotos.</p>
                        </div>
                    </div>
                    <label className="block cursor-pointer border-2 border-dashed border-slate-700 hover:border-red-500 rounded-2xl p-8 text-center transition-colors">
                        <Upload className="mx-auto text-slate-500 mb-3" size={32} />
                        <p className="font-bold">Seleccionar fotografías</p>
                        <p className="text-xs text-slate-500 mt-1">JPG, JPEG, PNG</p>
                        <input type="file" accept="image/*" multiple onChange={handleSeleccionarFotos} className="hidden" />
                    </label>
                    {fotos.length > 0 && (
                        <div className="mt-6">
                            <div className="flex justify-between text-sm mb-4">
                                <span className="text-slate-400">{fotos.length} archivos seleccionados</span>
                                <span className="text-slate-400">
                                    {fotosCompletadas}/{fotos.length}
                                    {' '}completados
                                </span>
                            </div>
                            <div className="max-h-72 overflow-y-auto space-y-2">
                                {fotos.map((item) => (
                                    <div key={item.id} className="bg-[#181A24] rounded-xl p-3 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-sm truncate">{item.file.name}</p>
                                            {item.error && (
                                                <p className="text-xs text-red-400 mt-1">{item.error}</p>
                                            )}
                                        </div>
                                        <div className="shrink-0 flex items-center gap-3">
                                            {item.status === 'PENDIENTE' && (
                                                <button
                                                type="button"  onClick={() => eliminarFoto(item.id)}
                                                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                                title="Quitar archivo"
                                                >
                                                <X size={16} />
                                                </button>
                                            )}

                                            {item.status === 'PENDIENTE' && (
                                                <span className="text-xs text-slate-500">Pendiente</span>
                                            )}

                                            {(item.status === 'SUBIENDO' ||
                                                item.status === 'CONFIRMANDO') && (
                                                <Loader2 size={18} className="animate-spin text-amber-400"/>
                                            )}

                                            {item.status === 'COMPLETADO' && (
                                                <CheckCircle2 size={19} className="text-emerald-500"/>
                                            )}

                                            {item.status === 'ERROR' && (
                                                <>
                                                <button type="button" onClick={() => eliminarFoto(item.id)}
                                                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-red-500"
                                                >
                                                    <X size={16} />
                                                </button>
                                                <XCircle size={19} className="text-red-500"/>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={handleSubirFotos}
                                disabled={subiendoFotos || !participanteId || todasLasFotosCompletadas}
                                className={`mt-5 w-full py-3.5 rounded-xl font-bold uppercase transition-colors ${
                                    todasLasFotosCompletadas
                                    ? 'bg-emerald-600 text-white cursor-default' : 
                                    subiendoFotos || !participanteId
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                                    }`}
                            >
                                {todasLasFotosCompletadas
                                ? `✓ ${fotos.length} fotografías subidas`
                                : subiendoFotos
                                    ? `Subiendo ${fotosCompletadas}/${fotos.length}...`
                                    : `Subir ${fotos.length} fotografías`}
                            </button>
                            {fotosError > 0 && (
                                <p className="text-xs text-red-400 mt-3 text-center">
                                    {fotosError} archivo
                                    {fotosError === 1
                                        ? ''
                                        : 's'}{' '}
                                    no se pudo
                                    {fotosError === 1
                                        ? ''
                                        : 'ieron'}{' '}
                                    subir.
                                </p>
                            )}
                        </div>
                    )}
                </div>
                {/* ============================================== */}
                {/* VIDEO */}
                {/* ============================================== */}
                <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-11 h-11 bg-red-500/10 rounded-xl flex items-center justify-center"><FileVideo className="text-red-500" /></div>
                        <div>
                            <h2 className="text-xl font-bold uppercase">Video</h2>
                            <p className="text-xs text-slate-400">Solo un video activo por participante.</p>
                        </div>
                    </div>
                    <label className="block cursor-pointer border-2 border-dashed border-slate-700 hover:border-red-500 rounded-2xl p-8 text-center transition-colors">
                        <Upload className="mx-auto text-slate-500 mb-3" size={32} />
                        <p className="font-bold"> Seleccionar video</p>
                        <input type="file" accept="video/*" onChange={handleSeleccionarVideo} className="hidden" />
                    </label>
                    {video && (
                        <div className="mt-5">
                            <div className="bg-[#181A24] rounded-xl p-4 flex items-center justify-between gap-4">
                                <div className="min-w-0"><p className="text-sm truncate">{video.file.name}</p>
                                    {video.error && (
                                        <p className="text-xs text-red-400 mt-1">
                                            {video.error}
                                        </p>
                                    )}
                                </div>
                                {video.status === 'COMPLETADO' && (
                                    <CheckCircle2 className="text-emerald-500" />
                                )}
                                {video.status === 'ERROR' && (
                                    <XCircle className="text-red-500" />
                                )}

                                {video.status === 'SUBIENDO' && (
                                    <Loader2 className="animate-spin text-amber-400" />
                                )}
                            </div>
                            <button type="button" onClick={handleSubirVideo}
                                disabled={subiendoVideo || !participanteId || video.status === 'COMPLETADO'}
                                className="mt-5 w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-3.5 rounded-xl font-bold uppercase transition-colors"
                            >
                                {subiendoVideo
                                    ? 'Subiendo video...'
                                    : 'Subir video'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}