import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { CartProvider } from './context/cartContext.tsx' // <-- Importamos
import { AuthProvider } from './context/authContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider> {/* <-- Envolvemos */}
        <App />
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
)