import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  UserPlus,
  CheckCircle2,
  Send,
  MailCheck
} from 'lucide-react';
import { loginClient, resendActivationEmail } from '../../lib/clientAuth';
import { ForgotPasswordModal } from './ForgotPasswordModal';

export const ClientLogin = ({ 
  onLoginSuccess, 
  onSwitchToRegister, 
  initialEmail = '',
  activationSuccessMessage = ''
}) => {
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUnconfirmed, setIsUnconfirmed] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccessMessage, setResendSuccessMessage] = useState('');
  const [resendErrorMessage, setResendErrorMessage] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsUnconfirmed(false);
    setResendSuccessMessage('');
    setResendErrorMessage('');

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setError('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    if (!cleanPassword) {
      setError('Por favor, digite sua senha de acesso.');
      return;
    }

    setLoading(true);

    try {
      const res = await loginClient(cleanEmail, cleanPassword, rememberMe);

      if (res.success && res.session) {
        if (onLoginSuccess) {
          onLoginSuccess(res.session);
        }
      } else {
        if (res.isUnconfirmed) {
          setIsUnconfirmed(true);
        }
        setError(res.error || 'E-mail ou senha incorretos. Verifique suas credenciais.');
      }
    } catch (err) {
      setError('Falha ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendActivation = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Informe seu e-mail acima para reenviarmos o link de ativação.');
      return;
    }

    setResendingEmail(true);
    setResendSuccessMessage('');
    setResendErrorMessage('');

    try {
      const res = await resendActivationEmail(cleanEmail);
      if (res.success) {
        setResendSuccessMessage(res.message || `Link de ativação reenviado para ${cleanEmail}! Verifique sua caixa de entrada e spam.`);
      } else {
        setResendErrorMessage(res.error || 'Não foi possível reenviar o link de ativação.');
      }
    } catch (err) {
      setResendErrorMessage('Erro ao reenviar o e-mail de ativação. Tente novamente.');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-2xl sm:rounded-3xl shadow-elevated border border-slate-100 p-6 sm:p-10 animate-fade-in">
      
      {/* Banner de Sucesso pós-ativação de e-mail */}
      {activationSuccessMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-start gap-3 shadow-xs animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="text-xs sm:text-sm">
            <h4 className="font-extrabold text-emerald-900 text-sm sm:text-base">Cadastro Ativado com Sucesso!</h4>
            <p className="text-emerald-800 mt-0.5 leading-relaxed">
              {activationSuccessMessage}
            </p>
          </div>
        </div>
      )}

      {/* Header do Formulário de Login */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-green-light border border-brand-green/30 text-brand-dark text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-brand-green" />
          <span>Área Exclusiva do Cliente</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Acesse sua conta
        </h2>
        
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
          Acompanhe o status do seu cadastro, atualize informações e reenvie documentos com agilidade.
        </p>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Campo E-mail */}
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
              setIsUnconfirmed(false);
            }}
            placeholder="seuemail@empresa.com.br"
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all"
          />
        </div>

        {/* Campo Senha */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-brand-teal" />
              <span>Sua Senha</span>
              <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(true)}
              className="text-[11px] font-semibold text-brand-teal hover:text-brand-dark hover:underline cursor-pointer"
            >
              Esqueceu a senha?
            </button>
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
                setIsUnconfirmed(false);
              }}
              placeholder="Digite sua senha cadastrada..."
              disabled={loading}
              className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex="-1"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Checkbox Lembrar-me */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 font-medium">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-brand-green focus:ring-brand-green/40 border-slate-300"
            />
            <span>Manter conectado neste dispositivo</span>
          </label>
        </div>

        {/* Mensagem de Erro Geral ou de Conta Não Confirmada */}
        {error && (
          <div className={`p-4 rounded-xl border text-xs flex flex-col gap-2.5 animate-shake ${
            isUnconfirmed 
              ? 'bg-amber-50 border-amber-300 text-amber-900' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <div className="flex items-start gap-2.5">
              {isUnconfirmed ? (
                <MailCheck className="w-4 h-4 flex-shrink-0 text-amber-700 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
              )}
              <span className="font-semibold leading-relaxed">{error}</span>
            </div>

            {/* Botão de Reenviar E-mail se a conta estiver pendente de ativação */}
            {isUnconfirmed && (
              <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <span className="text-[11px] text-amber-800">
                  Não recebeu o e-mail de ativação?
                </span>
                <button
                  type="button"
                  onClick={handleResendActivation}
                  disabled={resendingEmail}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {resendingEmail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Reenviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Reenviar e-mail de ativação</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Feedback de Sucesso no Reenvio */}
        {resendSuccessMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-fade-in font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{resendSuccessMessage}</span>
          </div>
        )}

        {/* Feedback de Erro no Reenvio */}
        {resendErrorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 animate-fade-in font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{resendErrorMessage}</span>
          </div>
        )}

        {/* Botão de Entrar */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-6 rounded-xl bg-[#1d5b79] hover:bg-[#144258] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#1d5b79]/25 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span>Verificando credenciais...</span>
            </>
          ) : (
            <>
              <span>Entrar no Portal do Cliente</span>
              <ArrowRight className="w-4 h-4 text-emerald-300" />
            </>
          )}
        </button>

        {/* Divisor */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-slate-400 font-medium">ou se preferir</span>
          </div>
        </div>

        {/* Botão de Trocar para Aba de Cadastro */}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="w-full py-3 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-700 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-brand-green" />
          <span>Ainda não sou cliente • Criar novo cadastro</span>
        </button>
      </form>

      {/* Modal de Esqueceu a Senha */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        initialEmail={email}
      />

      {/* Rodapé de Segurança */}
      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-brand-green" />
        <span>Acesso autenticado e protegido por criptografia de ponta a ponta</span>
      </div>
    </div>
  );
};
