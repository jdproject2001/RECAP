import React, { useState, useEffect } from 'react';
import { useCart, type Paquete, type Participante } from '../context/cartContext';

interface Evento {
  id: string;
  nombre: string;
  fecha: string;
  lugar: string;
}

interface Categoria {
  id: string;
  nombre_categoria: string;
}

export const Catalogo: React.FC = () => {
  const { addToCart, cart } = useCart();

  // Estados de los Datos de la API
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);

  // Estados de Selección del Usuario
  const [selectedEvento, setSelectedEvento] = useState<string>('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedParticipante, setSelectedParticipante] = useState<Participante | null>(null);

  const API_BASE = 'http://localhost:4000/api/v1';

  // 1. Cargar Eventos al montar el componente
  useEffect(() => {
    fetch(`${API_BASE}/eventos`)
      .then((res) => res.json())
      .then((data) => {
        setEventos(data);
        if (data.length > 0) setSelectedEvento(data[0].id);
      })
      .catch((err) => console.error('Error cargando eventos:', err));
  }, []);

  // 2. Cargar Categorías y Paquetes cuando cambia el evento
  useEffect(() => {
    if (!selectedEvento) return;
    fetch(`${API_BASE}/eventos/${selectedEvento}`)
      .then((res) => res.json())
      .then((data) => {
        setCategorias(data.categorias || []);
        setPaquetes(data.paquetes || []);
        setParticipantes([]);
        setSelectedParticipante(null);
        setSearchQuery('');
        if (data.categorias && data.categorias.length > 0) {
          setSelectedCategoria(data.categorias[0].id);
        } else {
          setSelectedCategoria('');
        }
      })
      .catch((err) => console.error('Error cargando detalles del evento:', err));
  }, [selectedEvento]);

  // 3. Buscar Participantes en tiempo real por Nombre o Dorsal
  useEffect(() => {
    if (!selectedCategoria || searchQuery.trim().length < 2) {
      setParticipantes([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetch(`${API_BASE}/categorias/${selectedCategoria}/participantes?q=${searchQuery}`)
        .then((res) => res.json())
        .then((data) => setParticipantes(data))
        .catch((err) => console.error('Error buscando participantes:', err));
    }, 300); // Debounce de 300ms para evitar saturar el backend mientras escribe

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedCategoria]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Encabezado 
        <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-xs">
          <div>
            <h1 className="text-2xl font-black text-indigo-600 tracking-tight">MEDIA SHOT</h1>
            <p className="text-sm text-slate-500">Reserva tus fotos y videos de carrera</p>
          </div>
          <div className="bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 font-bold text-indigo-700">
            🛒 Carrito ({cart.length})
          </div>
        </header>*/}

        {/* Paso 1: Selección del Evento */}
        <section className="bg-white p-6 rounded-xl shadow-xs mb-6">
          <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
            1. Selecciona el Evento Deportivo:
          </label>
          <select
            value={selectedEvento}
            onChange={(e) => setSelectedEvento(e.target.value)}
            className="w-full bg-slate-100 border border-slate-200 p-3 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.nombre} ({ev.lugar})
              </option>
            ))}
          </select>
        </section>

        {/* Paso 2: Categoría y Buscador de Participante */}
        {selectedEvento && (
          <section className="bg-white p-6 rounded-xl shadow-xs mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
                  2. Tu Categoría:
                </label>
                <select
                  value={selectedCategoria}
                  onChange={(e) => setSelectedCategoria(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre_categoria}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
                  3. Busca tu Nombre o Dorsal:
                </label>
                <input
                  type="text"
                  placeholder="Ej: 104 o Danna..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedParticipante(null);
                  }}
                  className="w-full bg-slate-100 border border-slate-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Resultados dinámicos del buscador */}
            {participantes.length > 0 && !selectedParticipante && (
              <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white">
                {participantes.map((part) => (
                  <div
                    key={part.id}
                    onClick={() => {
                      setSelectedParticipante(part);
                      setSearchQuery(`${part.nombre_completo} (#${part.dorsal_numero})`);
                    }}
                    className="p-3 hover:bg-indigo-50 cursor-pointer transition-colors flex justify-between font-medium"
                  >
                    <span>👤 {part.nombre_completo}</span>
                    <span className="text-indigo-600 font-bold"># {part.dorsal_numero}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Paso 3: Tarjetas de Paquetes Disponibles */}
        {selectedParticipante && paquetes.length > 0 && (
          <section className="animate-fade-in">
            <h3 className="text-md font-bold uppercase tracking-wider text-slate-500 mb-4">
              4. Elige los paquetes para <span className="text-indigo-600">{selectedParticipante.nombre_completo}</span>:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {paquetes.map((paj) => (
                <div key={paj.id} className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between shadow-xs">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm">
                      {paj.tipo}
                    </span>
                    <h4 className="font-bold text-lg mt-2">{paj.nombre_paquete}</h4>
                    <p className="text-sm text-slate-500 mt-1 leading-snug">{paj.descripcion}</p>
                  </div>
                  <div className="mt-6">
                    <div className="text-2xl font-black text-slate-900 mb-3">${parseFloat(paj.precio).toFixed(2)}</div>
                    <button
                      onClick={() => addToCart(paj, selectedParticipante)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      Añadir al Carrito
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
};