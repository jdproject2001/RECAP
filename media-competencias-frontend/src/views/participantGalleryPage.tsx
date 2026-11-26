import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon, Loader2, ShoppingCart } from 'lucide-react';
import { API_BASE } from '../config/api';
import { auth } from '../firebase/firebase';

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

export default function ParticipantGalleryPage() {
    const navigate = useNavigate();
    const {
        participantId
    } = useParams<{
        eventSlug: string;
        participantId: string;
    }>();

    const [multimedia, setMultimedia] = useState<Multimedia[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // =====================================================
    // CARGAR PREVIEWS
    // =====================================================
    useEffect(() => {
        const cargarFotos = async () => {
            if (!participantId) {
                setError('No se encontró el participante.');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const user = auth.currentUser;
                if (!user) {
                    throw new Error('Debes iniciar sesión para ver las fotografías.');
                }

                const token = await user.getIdToken();
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
                        data.error || 'No se pudieron cargar las fotografías.'
                    );
                }

                setMultimedia(data.multimedia || []);
            } catch (err) {
                console.error('Error cargando galería:', err);
                setError(
                    err instanceof Error
                        ? err.message
                        : 'No se pudieron cargar las fotografías.'
                );
            } finally {
                setLoading(false);
            }
        };

        cargarFotos();
    }, [participantId]);

    // =====================================================
    // SOLO FOTOS CON PREVIEW
    // =====================================================
    const fotos = useMemo(
        () =>
            multimedia.filter(
                item =>
                    item.tipo === 'FOTO' &&
                    item.activo &&
                    !!item.previewUrl
            ),
        [multimedia]
    );

    // =====================================================
    // VOLVER
    // =====================================================
    const volverAPaquetes = () => {
        navigate(-1);
    };

    // =====================================================
    // LOADING
    // =====================================================
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0D111C] text-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2
                        size={38}
                        className="animate-spin text-red-500 mx-auto mb-4"
                    />
                    <p className="text-slate-400">
                        Cargando tus fotografías...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0D111C] text-white pt-24 pb-20">
            <div className="max-w-7xl mx-auto px-6">
                {/* VOLVER */}
                <button
                    type="button"
                    onClick={volverAPaquetes}
                    className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium mb-8 cursor-pointer"
                >
                    <ArrowLeft size={17} />
                    Volver a paquetes
                </button>

                {/* CABECERA */}
                <div className="mb-8">
                    <p className="text-red-500 text-xs font-bold uppercase tracking-[0.2em] mb-2">
                        Tus fotografías
                    </p>
                    <h1
                        className="text-4xl md:text-5xl font-black uppercase"
                        style={{
                            fontFamily: '"Barlow Condensed", sans-serif'
                        }}
                    >
                        Encuentra tus mejores momentos
                    </h1>
                    <p className="text-slate-500 mt-3 max-w-5xl">
                        Estas imágenes son vistas previas. Puedes comprar tus favoritas desde nuestros paquetes de fotografía.
                    </p>
                </div>

                {/* ERROR */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-8">
                        {error}
                    </div>
                )}

                {/* SIN FOTOS */}
                {fotos.length === 0 && (
                    <div className="bg-[#12131A] border border-slate-800 rounded-2xl p-12 text-center">
                        <ImageIcon
                            size={42}
                            className="text-slate-600 mx-auto mb-4"
                        />
                        <p className="font-bold">
                            Todavía no hay fotografías disponibles.
                        </p>
                        <p className="text-sm text-slate-500 mt-2">
                            Cuando nuestro equipo termine de procesarlas aparecerán aquí.
                        </p>
                    </div>
                )}

                {/* GALERÍA */}
                {fotos.length > 0 && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                            {fotos.map((foto) => (
                                <div
                                    key={foto.id}
                                    className="group bg-[#12131A] border border-slate-800 rounded-2xl overflow-hidden"
                                >
                                    <div className="aspect-[4/5] bg-[#181A24] overflow-hidden">
                                        <img
                                            src={foto.previewUrl!}
                                            alt="Vista previa"
                                            loading="lazy"
                                            draggable={false}
                                            onContextMenu={e => e.preventDefault()}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* CTA */}
                        <div className="mt-12 bg-[#12131A] border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                            <div>
                                <h2 className="text-2xl font-black uppercase">
                                    ¿Encontraste tus fotos?
                                </h2>
                                <p className="text-slate-400 mt-1">
                                    Elige uno de nuestros paquetes para recibirlas en su calidad original.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={volverAPaquetes}
                                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-xl cursor-pointer whitespace-nowrap"
                            >
                                <ShoppingCart size={18} />
                                Ver paquetes
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}