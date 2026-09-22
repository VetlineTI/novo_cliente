import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Mail, 
  ArrowRight, 
  Sparkles,
  KeyRound,
  FileCheck
} from 'lucide-react';

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
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const protocolNumber = 'VET-' + Math.floor(100000 + Math.random() * 900000);

  const handleConfirm = () => {
    if (onReset) onReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden text-center p-6 sm:p-8 space-y-5">
        
        {/* Ícone Animado de Sucesso */}
        <div className="mx-auto w-20 h-20 rounded-full bg-brand-green-light text-brand-green flex items-center justify-center shadow-lg shadow-brand-green/20 pulse-glow">
          <CheckCircle2 className="w-12 h-12 stroke-[2.2]" />
        </div>

        {/* Título & Mensagem */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-dark bg-brand-green-light px-3.5 py-1 rounded-full border border-brand-green/40 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-green" />
            <span>Cadastro Enviado com Sucesso!</span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-1">
            Seja bem-vindo à Vetline!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Recebemos seus dados cadastrais e documentos para análise de credenciamento.
          </p>
        </div>

        {/* BOX DE ACESSO IMEDIATO LIBERADO */}
        <div className="bg-linear-to-b from-emerald-50/70 to-blue-50/50 rounded-2xl p-4 sm:p-5 border-2 border-emerald-200 text-left space-y-3 shadow-xs">
          <div className="flex items-center gap-2.5 text-emerald-800 font-extrabold text-sm sm:text-base">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <span>Acesso à Área do Cliente Criado!</span>
          </div>

          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Sua conta está criada e vinculada ao e-mail:
          </p>

          <div className="p-2.5 bg-white rounded-xl border border-emerald-200 text-xs font-bold text-slate-800 flex items-center justify-between break-all">
            <div className="flex items-center gap-2 truncate">
              <Mail className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="truncate">{data?.email || 'seu e-mail'}</span>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase ml-2 flex-shrink-0">
              Acesso Liberado
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Você já pode acessar a <strong>Área do Cliente</strong> a qualquer momento utilizando este e-mail e a senha que acabou de cadastrar para acompanhar seu status e gerenciar documentos.
          </p>
        </div>

        {/* Card com Detalhes do Protocolo */}
        <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-brand-teal" />
              <span>Protocolo de Análise</span>
            </span>
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
          </div>
        </div>

        {/* Botão de Ação: Ir para a Área do Cliente */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3.5 px-6 rounded-xl bg-[#1d5b79] hover:bg-[#144258] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#1d5b79]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Acessar Área do Cliente</span>
            <ArrowRight className="w-4 h-4 text-emerald-300" />
          </button>
        </div>
      </div>
    </div>
  );
};
