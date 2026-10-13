import { useEffect, useState } from "react";

const PAYPHONE_CSS = "https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css";

export function usePayPhoneAssets() {
  const [stylesReady, setStylesReady] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = PAYPHONE_CSS;
    link.dataset.recapPayphone = "true";
    link.onload = () => setStylesReady(true);
    link.onerror = () => {
      console.error("Error cargando CSS de PayPhone");
    };

    document.head.appendChild(link);

    return () => {
      link.remove();
    };
  }, []);

  return { stylesReady };
}