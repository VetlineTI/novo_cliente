import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, X, Check, Settings2 } from 'lucide-react';

const STORAGE_KEY = 'vetline_cookie_consent';

export const CookieConsentBanner = ({ onOpenPolicies }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        // Exibe com pequeno delay para transição suave
        const timer = setTimeout(() => setIsVisible(true), 600);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      // Falha silenciosa no acesso ao storage
    }
  }, []);

  // Escuta evento customizado para reabrir o banner a partir do rodapé
  useEffect(() => {
    const handleReopen = () => {
      setIsVisible(true);
    };

    window.addEventListener('open-cookie-preferences', handleReopen);
    return () => {
      window.removeEventListener('open-cookie-preferences', handleReopen);
    };
  }, []);

  const handleAcceptAll = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          essential: true,
          analytics: true,
          acceptedAt: new Date().toISOString()
        })
      );
    } catch (e) {}
    setIsVisible(false);
  };

  const handleAcceptEssential = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          essential: true,
          analytics: false,
          acceptedAt: new Date().toISOString()
        })
      );
    } catch (e) {}
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-6 sm:right-auto sm:max-w-xl z-50 animate-slide-up">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-200/90 text-slate-700 flex flex-col gap-3.5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                Privacidade & Cookies
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  LGPD
                </span>
              </h4>
              <button
                type="button"
                onClick={handleAcceptEssential}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                title="Fechar e aceitar apenas essenciais"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Utilizamos cookies essenciais para garantir o funcionamento seguro do credenciamento, autenticação e proteção de dados, em conformidade com a LGPD (Lei nº 13.709/2018).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onOpenPolicies?.('cookies')}
            className="text-[11px] font-semibold text-slate-500 hover:text-brand-green flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Ver Políticas & Detalhes</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleAcceptEssential}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              Apenas Essenciais
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="px-3.5 py-1.5 rounded-lg bg-brand-green hover:bg-emerald-600 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aceitar Todos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
