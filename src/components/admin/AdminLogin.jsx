import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import logoImg from '../../assets/vetline-logo.png';
import { loginAdmin, DEFAULT_ADMIN_CREDENTIALS } from '../../lib/adminAuth';
import { 
  getBruteForceStatus, 
  recordFailedLogin, 
  resetBruteForce, 
  formatRemainingTime 
} from '../../utils/bruteForceProtector';

export const AdminLogin = ({ onLoginSuccess, onBackToPortal }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Monitora status de bloqueio ao digitar
  useEffect(() => {
    const status = getBruteForceStatus(`admin_${email}`);
    setLockoutSeconds(status.remainingSeconds);
  }, [email]);

  // Contador regressivo em tempo real
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          const status = getBruteForceStatus(`admin_${email}`);
          return status.remainingSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds, email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    // 1. Checa se o acesso administrativo está temporariamente bloqueado
    const currentStatus = getBruteForceStatus(`admin_${cleanEmail}`);
    if (currentStatus.isLocked) {
      setLockoutSeconds(currentStatus.remainingSeconds);
      setErrorMessage(`Acesso bloqueado por segurança devido a excesso de tentativas. Aguarde ${formatRemainingTime(currentStatus.remainingSeconds)}.`);
      return;
    }

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage('Por favor, informe o e-mail e a senha administrativa.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginAdmin(cleanEmail, cleanPassword, rememberMe);
      if (res.success) {
        resetBruteForce(`admin_${cleanEmail}`);
        onLoginSuccess(res.user);
      } else {
        const lockRes = recordFailedLogin(`admin_${cleanEmail}`);
        setLockoutSeconds(lockRes.remainingSeconds);

        if (lockRes.isLocked) {
          setErrorMessage(`Limite de tentativas excedido! Acesso administrativo bloqueado por 5 minutos. Tente novamente em ${formatRemainingTime(lockRes.remainingSeconds)}.`);
        } else if (lockRes.attemptsLeft <= 2) {
          setErrorMessage(`Credenciais inválidas. Atenção: restam apenas ${lockRes.attemptsLeft} tentativa(s) antes do bloqueio.`);
        } else {
          setErrorMessage(res.error || 'Credenciais inválidas.');
        }
      }
    } catch (err) {
      setErrorMessage('Erro ao conectar ao serviço de autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLocked = lockoutSeconds > 0;

  const handleFillDemo = () => {
    setEmail(DEFAULT_ADMIN_CREDENTIALS.email);
    setPassword(DEFAULT_ADMIN_CREDENTIALS.password);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#0d2a30] px-4 py-8 relative overflow-hidden text-slate-100">

      {/* Background Decorativo com Gradientes Suaves */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-green/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-brand-teal/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Card Principal de Login */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-700/60 shadow-2xl p-6 sm:p-8 z-10 animate-fade-in">

        {/* Topo do Card com Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 mb-3">
            <img
              src={logoImg}
              alt="Vetline Distribuidora"
              className="h-10 w-auto object-contain brightness-110"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-green/15 text-brand-green text-xs font-bold border border-brand-green/30 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Acesso Restrito • Gestão Interna</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Painel Administrativo
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestão e aprovação de novos cadastros de clientes
          </p>
        </div>

        {/* Banner de Bloqueio se houver */}
        {isLocked && (
          <div className="mb-5 p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium space-y-2 animate-shake">
            <div className="flex items-center gap-2 font-bold text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>Painel Bloqueado Temporariamente</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Tentativas incorretas consecutivas excedidas. Aguarde o contador para nova tentativa.
            </p>
            <div className="flex items-center justify-between p-2 bg-black/40 rounded-lg text-xs font-bold text-red-100">
              <span>Tempo restante:</span>
              <span className="font-mono text-sm text-red-300 bg-red-950/80 px-2 py-0.5 rounded border border-red-800">
                {formatRemainingTime(lockoutSeconds)}
              </span>
            </div>
          </div>
        )}

        {/* Mensagem de Erro se houver */}
        {errorMessage && !isLocked && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium flex items-start gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              E-mail ou Usuário Administrativo
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vetline.com.br"
                disabled={isLoading || isLocked}
                className={`w-full border rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-all ${
                  isLocked ? 'bg-slate-800/40 border-slate-700 cursor-not-allowed opacity-50' : 'bg-slate-800/80 border-slate-700 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green'
                }`}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading || isLocked}
                className={`w-full border rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-all ${
                  isLocked ? 'bg-slate-800/40 border-slate-700 cursor-not-allowed opacity-50' : 'bg-slate-800/80 border-slate-700 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green'
                }`}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLocked}
                className="rounded border-slate-700 text-brand-green focus:ring-brand-green bg-slate-800 disabled:opacity-50"
              />
              <span>Manter conectado</span>
            </label>
          </div>

          {/* Botão de Entrar */}
          <button
            type="submit"
            disabled={isLoading || isLocked}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-green to-emerald-600 hover:from-brand-green-dark hover:to-emerald-700 text-white font-bold text-sm shadow-lg shadow-brand-green/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : isLocked ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Bloqueado ({formatRemainingTime(lockoutSeconds)})</span>
              </>
            ) : (
              <>
                <span>Entrar no Painel</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Botão de Retorno ao Portal Público */}
        {onBackToPortal && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onBackToPortal}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao formulário de cadastro público</span>
            </button>
          </div>
        )}
      </div>

      {/* Rodapé Seguro */}
      <div className="mt-8 text-center text-xs text-slate-500 z-10 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-brand-green" />
        <span>Vetline Distribuidora • Portal Administrativo Seguro</span>
      </div>
    </div>
  );
};
