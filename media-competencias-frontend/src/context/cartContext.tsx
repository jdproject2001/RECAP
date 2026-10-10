import React, { createContext, useContext, useState, type ReactNode } from 'react';

// 1. Definimos las interfaces según nuestro modelo de base de datos
export interface Paquete {
  id: string;
  nombre_paquete: string;
  descripcion: string;
  precio: number; // Postgres lo devuelve como string para evitar pérdida de decimales
  tipo: 'foto' | 'video' | 'combo';
}

export interface Participante {
  id: string;
  nombre_completo: string;
  dorsal_numero: string;
}

export type TipoCompra = 'RESERVA' | 'DIRECTA';
export interface CartItem {
  idUnique: string; // Combinación única de participante_id + paquete_id
  paquete: Paquete;
  participante: Participante;
  multimedia_ids: string[];
  tipoCompra: TipoCompra;
}

// 2. Definimos qué funciones y datos expondrá nuestro carrito a toda la app
interface CartContextType {
  cart: CartItem[];
  addToCart: (paquete: Paquete, participante: Participante, multimedia_ids: string[], tipoCompra: TipoCompra) => void;
  removeFromCart: (idUnique: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// 3. Proveedor del Contexto (El componente que envolverá la aplicación)
export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  // Añadir al carrito evitando duplicados exactos
  const addToCart = (paquete: Paquete, participante: Participante, multimedia_ids: string[], tipoCompra: TipoCompra) => {
    const idUnique = `${participante.id}-${paquete.id}`;
    
    setCart((prevCart) => {
      const exists = prevCart.some((item) => item.idUnique === idUnique);
      if (exists) return prevCart; // Si ya existe el mismo paquete para el mismo participante, no hace nada
      return [...prevCart, { idUnique, paquete, participante, multimedia_ids, tipoCompra }];
    });
  };

  // Eliminar un ítem específico del carrito
  const removeFromCart = (idUnique: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.idUnique !== idUnique));
  };

  // Vaciar el carrito
  const clearCart = () => setCart([]);

  // Calcular el total de la compra de forma dinámica en la interfaz
  const getCartTotal = () => {
    return cart.reduce((total, item) => total + Number(item.paquete.precio), 0);
  };

  // Saber cuántos productos hay en total
  const getCartCount = () => cart.length;

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, getCartTotal, getCartCount }}>
      {children}
    </CartContext.Provider>
  );
};

// Hook personalizado para consumir el carrito de forma rápida y limpia en cualquier pantalla
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser utilizado dentro de un CartProvider');
  }
  return context;
};