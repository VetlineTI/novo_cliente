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
  CheckCircle2
} from 'lucide-react';
import { loginClient } from '../../lib/clientAuth';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { 
  getBruteForceStatus, 
  recordFailedLogin, 
  resetBruteForce, 
  formatRemainingTime 
} from '../../utils/bruteForceProtector';

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
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(5);

  // Checa status de bloqueio por força bruta ao carregar ou digitar e-mail
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    const status = getBruteForceStatus(email);
    setLockoutSeconds(status.remainingSeconds);
    setAttemptsLeft(status.attemptsLeft);
  }, [email]);

  // Contador regressivo em tempo real
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          const status = getBruteForceStatus(email);
          setAttemptsLeft(status.attemptsLeft);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds, email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    // 1. Checa se o usuário está em período de bloqueio
    const currentStatus = getBruteForceStatus(cleanEmail);
    if (currentStatus.isLocked) {
      setLockoutSeconds(currentStatus.remainingSeconds);
      setError(`Acesso bloqueado por excesso de tentativas. Aguarde ${formatRemainingTime(currentStatus.remainingSeconds)} para tentar novamente.`);
      return;
    }

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
        // Sucesso: reseta o histórico de tentativas
        resetBruteForce(cleanEmail);
        if (onLoginSuccess) {
          onLoginSuccess(res.session);
        }
      } else {
        // Falha: registra tentativa de força bruta
        const lockRes = recordFailedLogin(cleanEmail);
        setLockoutSeconds(lockRes.remainingSeconds);
        setAttemptsLeft(lockRes.attemptsLeft);

        if (lockRes.isLocked) {
          setError(`Limite de tentativas excedido! Por segurança, o acesso foi bloqueado por 5 minutos. Tente novamente em ${formatRemainingTime(lockRes.remainingSeconds)}.`);
        } else if (lockRes.attemptsLeft <= 2) {
          setError(`Senha incorreta. Atenção: restam apenas ${lockRes.attemptsLeft} tentativa(s) antes do bloqueio de segurança.`);
        } else {
          setError(res.error || 'E-mail ou senha incorretos. Verifique suas credenciais.');
        }
      }
    } catch (err) {
      setError('Falha ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const isLocked = lockoutSeconds > 0;

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

      {/* Banner de Bloqueio por Força Bruta */}
      {isLocked && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 space-y-2 animate-shake shadow-xs">
          <div className="flex items-center gap-2 font-bold text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>Acesso Temporariamente Bloqueado</span>
          </div>
          <p className="text-xs text-red-800 leading-relaxed">
            Por medida de segurança, o acesso foi suspenso devido a 5 tentativas consecutivas incorretas.
          </p>
          <div className="flex items-center justify-between p-2.5 bg-red-100/70 border border-red-200 rounded-xl text-xs font-bold text-red-950">
            <span>Tempo restante para liberação:</span>
            <span className="font-mono text-base text-red-700 bg-white px-2.5 py-0.5 rounded-lg border border-red-300 shadow-2xs">
              {formatRemainingTime(lockoutSeconds)}
            </span>
          </div>
        </div>
      )}

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
            disabled={loading || isLocked}
            className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-800 placeholder-slate-400 transition-all ${
              isLocked ? 'bg-slate-100 border-slate-300 cursor-not-allowed text-slate-500' : 'bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green'
            }`}
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
              disabled={isLocked}
              className="text-[11px] font-semibold text-brand-teal hover:text-brand-dark hover:underline cursor-pointer disabled:opacity-50"
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
              disabled={loading || isLocked}
              className={`w-full pl-4 pr-11 py-3 rounded-xl border text-sm text-slate-800 placeholder-slate-400 transition-all ${
                isLocked ? 'bg-slate-100 border-slate-300 cursor-not-allowed text-slate-500' : 'bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex="-1"
              disabled={isLocked}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors disabled:opacity-50"
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
              disabled={isLocked}
              className="w-4 h-4 rounded text-brand-green focus:ring-brand-green/40 border-slate-300 disabled:opacity-50"
            />
            <span>Manter conectado neste dispositivo</span>
          </label>
        </div>

        {/* Mensagem de Erro Geral */}
        {error && !isLocked && (
          <div className="p-4 rounded-xl border bg-red-50 border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-shake font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Botão de Entrar */}
        <button
          type="submit"
          disabled={loading || isLocked}
          className="w-full py-3.5 px-6 rounded-xl bg-[#1d5b79] hover:bg-[#144258] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#1d5b79]/25 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span>Verificando credenciais...</span>
            </>
          ) : isLocked ? (
            <>
              <Lock className="w-4 h-4 text-white/80" />
              <span>Bloqueado ({formatRemainingTime(lockoutSeconds)})</span>
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
