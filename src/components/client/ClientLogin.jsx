import React, { useState } from 'react';
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
  UserPlus
} from 'lucide-react';
import { loginClient } from '../../lib/clientAuth';
import { ForgotPasswordModal } from './ForgotPasswordModal';

export const ClientLogin = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setError('Por favor, informe seu e-mail.');
      return;
    }

    if (!cleanPassword) {
      setError('Por favor, digite sua senha.');
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
        setError(res.error || 'E-mail ou senha incorretos. Verifique suas credenciais.');
      }
    } catch (err) {
      console.error('Erro no login do cliente:', err);
      setError('Falha ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-2xl sm:rounded-3xl shadow-elevated border border-slate-100 p-6 sm:p-10 animate-fade-in">
      
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

        {/* Mensagem de Erro */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
            <span className="font-medium leading-relaxed">{error}</span>
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
