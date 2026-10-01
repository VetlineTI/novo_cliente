import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  X, 
  CheckCircle2, 
  Mail, 
  KeyRound,
  UserCheck
} from 'lucide-react';
import { isValidEmail } from '../utils/validators';

export const CreatePasswordModal = ({
  isOpen,
  onClose,
  email: initialEmail = '',
  fullName = '',
  onSubmit,
  isSubmitting = false
}) => {
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Sincroniza o e-mail inicial sempre que a modal abrir
  useEffect(() => {
    if (isOpen) {
      setLoginEmail(initialEmail || '');
      setPassword('');
      setConfirmPassword('');
      setError('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPass = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanEmail) {
      setError('Por favor, informe seu e-mail para acesso.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    if (!cleanPass) {
      setError('Por favor, crie uma senha de acesso.');
      return;
    }

    if (cleanPass.length < 8) {
      setError('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    if (!/[A-Z]/.test(cleanPass)) {
      setError('A senha deve conter pelo menos uma letra maiúscula (A-Z).');
      return;
    }

    if (!/[a-z]/.test(cleanPass)) {
      setError('A senha deve conter pelo menos uma letra minúscula (a-z).');
      return;
    }

    if (!/[0-9]/.test(cleanPass)) {
      setError('A senha deve conter pelo menos um número (0-9).');
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±]/.test(cleanPass)) {
      setError('A senha deve conter pelo menos um caractere especial (ex: @, #, $, %, !).');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setError('As senhas digitadas não coincidem. Verifique e tente novamente.');
      return;
    }

    onSubmit(cleanEmail, cleanPass);
  };

  const isEmailValid = Boolean(loginEmail.trim() && isValidEmail(loginEmail.trim()));
  
  // Regras da política de senhas fortes
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±]/.test(password);
  const isMatchValid = password.length > 0 && password === confirmPassword;

  const passedRulesCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
  
  const getStrengthInfo = () => {
    if (password.length === 0) return { label: 'Vazia', color: 'bg-slate-200', text: 'text-slate-400', width: 'w-0' };
    if (passedRulesCount <= 2) return { label: 'Fraca', color: 'bg-red-500', text: 'text-red-600', width: 'w-1/3' };
    if (passedRulesCount <= 4) return { label: 'Média', color: 'bg-amber-500', text: 'text-amber-600', width: 'w-2/3' };
    return { label: 'Forte e Segura', color: 'bg-emerald-500', text: 'text-emerald-600', width: 'w-full' };
  };

  const strength = getStrengthInfo();

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden relative animate-scale-up my-auto">
        
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Topo / Header da Modal */}
        <div className="p-5 sm:p-6 text-center border-b border-slate-100 bg-linear-to-b from-slate-50/80 to-white space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-green-light text-brand-green flex items-center justify-center shadow-md shadow-brand-green/20">
            <KeyRound className="w-6 h-6 stroke-[2.2]" />
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Acesso à Área do Cliente
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xs mx-auto">
              Crie uma <strong>senha segura</strong> para acompanhar sua solicitação e gerenciar pedidos.
            </p>
          </div>
        </div>

        {/* Formulário de Login & Senha */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-3.5">
          
          {/* Campo E-mail de Login */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>E-mail para Login <span className="text-red-500">*</span></span>
              {isEmailValid && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Válido
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="seu.email@exemplo.com"
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all pl-10 ${
                  loginEmail && !isValidEmail(loginEmail.trim()) ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200'
                }`}
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Campo Criar Senha */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Criar Senha Forte <span className="text-red-500">*</span>
              </label>
              {password.length > 0 && (
                <span className={`text-[10px] font-bold ${strength.text}`}>
                  {strength.label}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Mínimo 8 caracteres..."
                autoFocus
                disabled={isSubmitting}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all pl-10 pr-10"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Barra de Força da Senha */}
            {password.length > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div className={`h-full transition-all duration-300 ${strength.color} ${strength.width}`}></div>
              </div>
            )}
          </div>

          {/* Campo Confirmar Senha */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Confirmar Senha <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Repita a senha criada..."
                disabled={isSubmitting}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all pl-10 pr-10"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Checklist de Requisitos de Segurança */}
          <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/70 space-y-1 text-[11px]">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Requisitos de Segurança da Senha:
            </span>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <div className={`flex items-center gap-1 font-medium transition-colors ${hasMinLength ? 'text-emerald-700' : 'text-slate-400'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${hasMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Mínimo 8 dígitos</span>
              </div>
              <div className={`flex items-center gap-1 font-medium transition-colors ${hasUppercase ? 'text-emerald-700' : 'text-slate-400'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${hasUppercase ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Letra maiúscula (A-Z)</span>
              </div>
              <div className={`flex items-center gap-1 font-medium transition-colors ${hasLowercase ? 'text-emerald-700' : 'text-slate-400'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${hasLowercase ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Letra minúscula (a-z)</span>
              </div>
              <div className={`flex items-center gap-1 font-medium transition-colors ${hasNumber ? 'text-emerald-700' : 'text-slate-400'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${hasNumber ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Número (0-9)</span>
              </div>
              <div className={`flex items-center gap-1 font-medium transition-colors col-span-2 ${hasSpecial ? 'text-emerald-700' : 'text-slate-400'}`}>
                <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${hasSpecial ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Caractere especial (@, #, $, %, etc.)</span>
              </div>
              {confirmPassword.length > 0 && (
                <div className={`flex items-center gap-1 font-medium transition-colors col-span-2 ${isMatchValid ? 'text-emerald-700' : 'text-red-500'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${isMatchValid ? 'text-emerald-600' : 'text-red-400'}`} />
                  <span>{isMatchValid ? 'Senhas conferem' : 'Senhas não coincidem'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 animate-fade-in font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="pt-1 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting || passedRulesCount < 5 || !isMatchValid}
              className="w-full py-3 px-5 rounded-xl bg-[#1d5b79] hover:bg-[#144258] active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-[#1d5b79]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Enviando cadastro...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>Concluir e Enviar Cadastro</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-1.5 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Voltar ao formulário
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
