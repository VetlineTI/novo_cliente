import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Mail, 
  ArrowRight, 
  Send, 
  Loader2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { resendActivationEmail } from '../lib/clientAuth';

export const SuccessModal = ({ isOpen, onClose, data, onReset }) => {
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState({ message: '', error: false });

  useEffect(() => {
    if (isOpen) {
      setResendStatus({ message: '', error: false });
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

  const handleResend = async () => {
    if (!data?.email) return;
    setResending(true);
    setResendStatus({ message: '', error: false });

    try {
      const res = await resendActivationEmail(data.email);
      if (res.success) {
        setResendStatus({ 
          message: res.message || `Link reenviado para ${data.email}!`, 
          error: false 
        });
      } else {
        setResendStatus({ 
          message: res.error || 'Não foi possível reenviar agora.', 
          error: true 
        });
      }
    } catch (e) {
      setResendStatus({ message: 'Erro ao reenviar e-mail.', error: true });
    } finally {
      setResending(false);
    }
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
          <span className="text-xs font-bold uppercase tracking-widest text-brand-dark bg-brand-green-light px-3.5 py-1 rounded-full border border-brand-green/40">
            Cadastro Recebido com Sucesso!
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-1">
            Seja bem-vindo à Vetline!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Recebemos seus dados cadastrais e documentos para análise de credenciamento.
          </p>
        </div>

        {/* BOX DE ATIVAÇÃO DE E-MAIL OBRIGATÓRIA */}
        <div className="bg-linear-to-b from-blue-50/80 to-emerald-50/50 rounded-2xl p-4 sm:p-5 border-2 border-blue-200 text-left space-y-3 shadow-xs">
          <div className="flex items-center gap-2.5 text-[#1d5b79] font-extrabold text-sm sm:text-base">
            <div className="w-8 h-8 rounded-lg bg-[#1d5b79] text-white flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <span>Ativação de Conta Necessária</span>
          </div>

          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Enviamos um <strong>e-mail de confirmação</strong> para:
          </p>

          <div className="p-2.5 bg-white rounded-xl border border-blue-200 text-xs font-bold text-[#1d5b79] flex items-center justify-between break-all">
            <span className="truncate">{data?.email || 'seu e-mail'}</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full uppercase ml-2 flex-shrink-0">
              Link de ativação
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            👉 <strong>Clique no link recebido no seu e-mail</strong> para ativar seu acesso. Após o clique, você será redirecionado para a tela de login (<strong>"Já sou cliente"</strong>) para entrar com sua senha.
          </p>

          {/* Reenvio inline */}
          <div className="pt-2 border-t border-blue-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              Não encontrou na caixa de entrada ou spam?
            </span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-xs font-bold text-[#1d5b79] hover:text-[#144258] underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {resending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reenviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Reenviar link</span>
                </>
              )}
            </button>
          </div>

          {resendStatus.message && (
            <p className={`text-[11px] font-semibold pt-1 ${resendStatus.error ? 'text-red-600' : 'text-emerald-700'}`}>
              {resendStatus.message}
            </p>
          )}
        </div>

        {/* Card com Detalhes do Protocolo */}
        <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
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
          </div>
        </div>

        {/* Botão de Ação: Ir para a tela de Login */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3.5 px-6 rounded-xl bg-[#1d5b79] hover:bg-[#144258] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#1d5b79]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Ir para o Login ("Já sou cliente")</span>
            <ArrowRight className="w-4 h-4 text-emerald-300" />
          </button>
        </div>
      </div>
    </div>
  );
};
