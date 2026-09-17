import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export const SuccessModal = ({ isOpen, onClose, data, onReset }) => {
  useEffect(() => {
    if (isOpen) {
      // Dispara confetes de comemoração
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#85b934', '#1d5b79', '#709d29', '#144258']
        });
      } catch (e) {
        // ignore
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const protocolNumber = 'VET-' + Math.floor(100000 + Math.random() * 900000);

  const handleConfirm = () => {
    if (onReset) onReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden text-center p-6 sm:p-8 space-y-6">
        
        {/* Ícone Animado de Sucesso */}
        <div className="mx-auto w-20 h-20 rounded-full bg-brand-green-light text-brand-green flex items-center justify-center shadow-lg shadow-brand-green/20 pulse-glow">
          <CheckCircle2 className="w-12 h-12 stroke-[2.2]" />
        </div>

        {/* Título & Mensagem */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-dark bg-brand-green-light px-3.5 py-1 rounded-full border border-brand-green/40">
            Cadastro Recebido com Sucesso!
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-1">
            Seja bem-vindo à Vetline!
          </h2>
          <p className="text-sm text-slate-600">
            Recebemos seus dados e documentos. Nossa equipe de credenciamento já está analisando suas informações.
          </p>
        </div>

        {/* Card com Detalhes do Protocolo */}
        <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 text-left space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <span className="text-xs font-medium text-slate-500">Protocolo de Análise</span>
            <span className="text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
              {protocolNumber}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Cliente / Razão</span>
              <span className="font-semibold text-slate-800 truncate block">
                {data?.full_name || 'Cliente'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">
                {data?.person_type === 'PF' ? 'CPF' : 'CNPJ'}
              </span>
              <span className="font-semibold text-slate-800 truncate block">
                {data?.document_number || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">E-mail</span>
              <span className="font-semibold text-slate-800 truncate block">
                {data?.email || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Telefone</span>
              <span className="font-semibold text-slate-800 truncate block">
                {data?.phone || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Próximos Passos */}
        <div className="space-y-2 text-left bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/60">
          <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand-green" />
            O que acontece agora?
          </h4>
          <ul className="text-xs text-slate-600 space-y-1 pl-5 list-disc marker:text-emerald-500">
            <li>Nossa equipe validará seus documentos em até 24 horas úteis.</li>
            <li>Você receberá a confirmação e sua tabela de preços no e-mail e WhatsApp.</li>
            <li>Um consultor dedicado ficará à sua disposição para o primeiro pedido.</li>
          </ul>
        </div>

        {/* Botão Único: OK */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3.5 px-6 rounded-xl bg-brand-green hover:bg-brand-dark text-white font-bold text-sm sm:text-base shadow-lg shadow-brand-green/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>OK</span>
          </button>
        </div>
      </div>
    </div>
  );
};
