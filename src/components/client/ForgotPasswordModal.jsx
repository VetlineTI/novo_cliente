import React, { useState } from 'react';
import { 
  KeyRound, 
  Mail, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Phone,
  ShieldCheck
} from 'lucide-react';
import { sendPasswordResetEmail } from '../../lib/clientAuth';

export const ForgotPasswordModal = ({ isOpen, onClose, initialEmail = '' }) => {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    setLoading(true);

    try {
      const res = await sendPasswordResetEmail(cleanEmail);

      if (res.success) {
        setSent(true);
        setMessage(res.message || 'Link de recuperação enviado com sucesso!');
      } else {
        setError(res.error || 'Não foi possível enviar o e-mail de recuperação.');
      }
    } catch (err) {
      setError('Ocorreu um erro ao processar seu pedido. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setError('');
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden relative animate-scale-up">
        
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Topo / Header da Modal */}
        <div className="p-6 sm:p-7 text-center border-b border-slate-100 bg-linear-to-b from-slate-50/80 to-white space-y-3">
          <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center shadow-md transition-all ${
            sent 
              ? 'bg-emerald-100 text-emerald-600 shadow-emerald-500/20' 
              : 'bg-brand-green-light text-brand-green shadow-brand-green/20'
          }`}>
            {sent ? <CheckCircle2 className="w-7 h-7 stroke-[2.2]" /> : <KeyRound className="w-7 h-7 stroke-[2.2]" />}
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {sent ? 'Link Enviado!' : 'Esqueceu sua senha?'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              {sent 
                ? 'Verifique sua caixa de entrada para criar sua nova senha de acesso.' 
                : 'Informe seu e-mail cadastrado e enviaremos um link para você redefinir sua senha com segurança.'}
            </p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 sm:p-7">
          {sent ? (
            /* Estado de Sucesso */
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <Mail className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Instruções enviadas para:</span>
                </p>
                <p className="font-semibold text-slate-800 bg-white p-2 rounded-lg border border-emerald-200/80 font-mono text-center truncate">
                  {email}
                </p>
                <p className="text-[11px] text-emerald-700 leading-relaxed pt-1">
                  1. Abra o e-mail recebido da Vetline / Supabase.<br />
                  2. Clique no link de redefinição.<br />
                  3. Defina sua nova senha de acesso.
                </p>
              </div>

              <div className="text-[11px] text-slate-400 text-center">
                Não recebeu? Verifique a pasta de <strong>Spam / Lixo Eletrônico</strong> ou solicite novamente em alguns instantes.
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3.5 px-5 rounded-xl bg-brand-green hover:bg-brand-dark text-white font-bold text-sm shadow-md shadow-brand-green/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Entendi, vou verificar meu e-mail</span>
              </button>
            </div>
          ) : (
            /* Formulário para Digitar E-mail */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand-teal" />
                  <span>E-mail cadastrado</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="exemplo@vetline.com.br"
                  autoFocus
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all"
                />
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#1d5b79] hover:bg-[#144258] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#1d5b79]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Enviando link de recuperação...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar Link de Recuperação</span>
                      <ArrowRight className="w-4 h-4 text-emerald-300" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Voltar para o login
                </button>
              </div>

              {/* Suporte Alternativo */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500">
                <span>Precisa de ajuda imediata?</span>
                <a
                  href="https://wa.me/5500000000000?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20recuperar%20meu%20acesso%20ao%20portal%20do%20cliente%20Vetline."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-brand-teal hover:underline inline-flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" />
                  <span>WhatsApp de Suporte</span>
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
