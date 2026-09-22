import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Users, FileWarning, RefreshCw, X, ShieldAlert } from 'lucide-react';

export const PartnerMismatchModal = ({
  isOpen,
  onClose,
  title = 'O cadastro não foi concluído',
  subtitle = 'Divergência identificada na validação cadastral',
  reasons = [],
  authorizedPartners = [],
  buttonText = 'Reenviar Documentos',
  onReupload
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-rose-100 overflow-hidden relative animate-scale-up">
        
        {/* Topo / Header com alerta */}
        <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-6 text-white text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-rose-200 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldAlert className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">{title}</h3>
          <p className="text-rose-100 text-xs mt-1">{subtitle}</p>
        </div>

        {/* Corpo com motivos */}
        <div className="p-6 space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
              <FileWarning className="w-4 h-4 text-rose-600" />
              <span>Motivo da não aprovação:</span>
            </div>
            <ul className="space-y-1.5 text-xs text-rose-900 leading-relaxed pl-1">
              {(reasons.length > 0 ? reasons : ['Não foi possível validar as informações cadastrais.']).map((r, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-rose-500 font-bold">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Lista de Sócios Autorizados (se aplicável) */}
          {authorizedPartners && authorizedPartners.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                <Users className="w-4 h-4 text-brand-teal" />
                <span>Sócios Registrados no CNPJ (QSA Oficial):</span>
              </div>
              <div className="space-y-1.5">
                {authorizedPartners.map((socio, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="truncate">{socio}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 italic mt-1">
                * Anexe a CNH ou RG de um dos sócios listados acima para validar seu cadastro.
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="pt-2 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                if (onReupload) onReupload();
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{buttonText}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
            >
              Fechar e revisar formulário
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

