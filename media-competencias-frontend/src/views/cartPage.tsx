import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, ShoppingCart } from "lucide-react";
import { useCart } from "../context/cartContext";
import { useAuth } from "../context/authContext";

export default function CartPage() {
    const navigate = useNavigate();
    const { cart, removeFromCart, clearCart } = useCart();
    const { user } = useAuth();

    // Función de apoyo para extraer el precio sin riesgo de NaN
    const getItemPrice = (item: any): number => {
        const rawPrice = item.paquete?.precio ?? item.precio ?? 0;
        const numericPrice = Number(rawPrice);
        return isNaN(numericPrice) ? 0 : numericPrice;
    };

    const total = cart.reduce((sum: number, item: any) => sum + getItemPrice(item), 0);
    const reservas = cart.filter(item => item.tipoCompra === 'RESERVA').length;
    const comprasDirectas = cart.filter(item => item.tipoCompra === 'DIRECTA').length;
    const handleCheckout = () => {
        if (cart.length === 0) return;
        if (!user) {
            navigate('/login');
            return;
        }
        navigate('/checkout');
    };

    // Función para manejar la eliminación enviando un ID en formato string
    const handleRemoveItem = (item: any) => {
        // Extraemos la propiedad idUnique que el context está filtrando
        // Si no viniera a nivel raíz, intentamos construir la clave combinada por respaldo
        const targetId = item.idUnique || item.id || `${item.paquete?.id}-${item.participante?.id}`;

        if (targetId) {
            removeFromCart(targetId);
        }
    };

    return (
        <div className="min-h-screen bg-[#0D111C] text-white pt-24 pb-12">
            <div className="max-w-4xl mx-auto px-6">

                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium cursor-pointer mb-8"
                >
                    <ArrowLeft size={16} />
                    <span>Seguir comprando</span>
                </button>

                <h1 className="text-3xl font-black uppercase tracking-wide text-white mb-6" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                    Tu Carrito de Compras
                </h1>

                {cart.length === 0 ? (
                    <div className="text-center py-20 bg-[#12131A] border border-slate-800 rounded-2xl">
                        <ShoppingCart size={48} className="mx-auto text-slate-600 mb-4" />
                        <p className="text-slate-400 font-medium">Tu carrito está vacío.</p>
                        <button
                            onClick={() => navigate("/")}
                            className="mt-6 bg-red-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-red-500 transition-colors"
                        >
                            Explorar Eventos
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-8">

                        {/* LISTA DE ITEMS */}
                        <div className="flex-1 space-y-4">
                            {cart.map((item: any, idx: number) => {
                                // Compatibilidad de lectura según el objeto en contexto
                                const paquete = item.paquete || item;
                                const participante = item.participante || item;
                                const price = getItemPrice(item);

                                return (
                                    <div key={idx} className="flex flex-col sm:flex-row items-center justify-between p-5 bg-[#12131A] border border-slate-800 rounded-2xl gap-4">
                                        <div>
                                            <h3 className="font-bold text-white uppercase text-lg" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                                                {paquete.nombre_paquete || paquete.nombrePaquete || "Paquete Seleccionado"}
                                                {(paquete.tipo || item.tipo) && (
                                                    <span className="text-slate-500 font-normal lowercase text-sm ml-2">
                                                        ({paquete.tipo || item.tipo})
                                                    </span>
                                                )}
                                            </h3>

                                            <p className="text-sm text-slate-300 mt-1">
                                                <span className="text-white font-semibold">
                                                    {participante.nombre_completo || participante.nombreParticipante || "Participante"}
                                                </span>
                                                <span className="text-slate-500 mx-2">•</span>
                                                <span className="font-mono text-red-400">
                                                    Dorsal #{participante.dorsal_numero || participante.dorsal || "S/N"}
                                                </span>
                                            </p>

                                            {participante.nombre_categoria && (
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Categoría: {participante.nombre_categoria}
                                                </p>
                                            )}

                                            {item.tipoCompra === 'RESERVA' ? (
                                                <div className="mt-3">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                                        Reserva
                                                    </span>

                                                    <p className="text-xs text-slate-400 mt-2 max-w-md">
                                                        El material todavía no está disponible. Cuando sea cargado,
                                                        podrás seleccionarlo desde tus compras sin volver a pagar.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="mt-3">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                                        Compra directa
                                                    </span>

                                                    <p className="text-xs text-slate-400 mt-2">
                                                        {item.multimedia_ids?.length || 0} archivo
                                                        {(item.multimedia_ids?.length || 0) === 1 ? '' : 's'} seleccionado
                                                        {(item.multimedia_ids?.length || 0) === 1 ? '' : 's'}.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800/60">
                                            <span className="text-2xl font-black text-red-500" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                                                ${price.toFixed(2)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(item)}
                                                className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors p-2.5 bg-[#181a24] rounded-xl cursor-pointer"
                                                title="Eliminar elemento"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            <button
                                onClick={clearCart}
                                className="text-xs text-slate-500 hover:text-red-400 transition-colors mt-4 cursor-pointer underline"
                            >
                                Vaciar carrito
                            </button>
                        </div>

                        {/* RESUMEN DEL PEDIDO */}
                        <div className="w-full lg:w-80 h-fit bg-[#12131A] border border-slate-800 rounded-2xl p-6">
                            <h3 className="font-bold text-lg mb-4 text-white uppercase" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                                Resumen del Pedido
                            </h3>

                            <div className="flex justify-between items-center text-slate-400 text-sm mb-3">
                                <span>Subtotal ({cart.length} {cart.length === 1 ? 'ítem' : 'ítems'})</span>
                                <span className="text-white font-medium">${total.toFixed(2)}</span>
                            </div>

                            <div className="border-t border-slate-800 my-4"></div>

                            <div className="flex justify-between items-center mb-6">
                                <span className="font-bold text-white">Total</span>
                                <span className="text-3xl font-black text-red-500" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
                                    ${total.toFixed(2)} <span className="text-xs text-slate-400">USD</span>
                                </span>
                            </div>

                            <div className="text-xs text-slate-500 space-y-1 mb-4">
                                {reservas > 0 && (
                                    <p>{reservas} {reservas === 1 ? 'reserva' : 'reservas'}</p>
                                )}
                                {comprasDirectas > 0 && (
                                    <p>{comprasDirectas}{' '}{comprasDirectas === 1 ? 'compra directa' : 'compras directas'}</p>
                                )}
                            </div>

                            <button
                                onClick={handleCheckout}
                                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-600/20 uppercase tracking-wider text-sm cursor-pointer"
                                style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
                            >
                                Proceder al Pago
                            </button>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}