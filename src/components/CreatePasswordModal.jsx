import React, { useState, useEffect } from 'react';
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
    }
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

    if (cleanPass.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setError('As senhas digitadas não coincidem. Verifique e tente novamente.');
      return;
    }

    onSubmit(cleanEmail, cleanPass);
  };

  const isEmailValid = Boolean(loginEmail.trim() && isValidEmail(loginEmail.trim()));
  const isLengthValid = password.length >= 6;
  const isMatchValid = password.length > 0 && password === confirmPassword;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden relative animate-scale-up">
        
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
        <div className="p-6 sm:p-7 text-center border-b border-slate-100 bg-linear-to-b from-slate-50/80 to-white space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-green-light text-brand-green flex items-center justify-center shadow-md shadow-brand-green/20">
            <KeyRound className="w-7 h-7 stroke-[2.2]" />
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Acesso à Área do Cliente
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Confirme seu <strong>e-mail de login</strong> e defina sua <strong>senha</strong>. Um link de ativação será enviado para este e-mail para liberar seu acesso.
            </p>
          </div>
        </div>

        {/* Formulário de Login & Senha */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          
          {/* Campo E-mail de Login */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>E-mail para Login <span className="text-red-500">*</span></span>
              {isEmailValid && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> E-mail válido
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
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all pl-10 ${
                  loginEmail && !isValidEmail(loginEmail.trim()) ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200'
                }`}
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Este e-mail será utilizado para entrar na aba <strong>"Já sou cliente"</strong>.
            </p>
          </div>

          {/* Campo Criar Senha */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Criar Senha de Acesso <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Mínimo 6 dígitos..."
                autoFocus
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all pl-10 pr-10"
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
          </div>

          {/* Campo Confirmar Senha */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all pl-10 pr-10"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Indicadores de Requisito */}
          <div className="space-y-1.5 pt-1 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div className={`flex items-center gap-1.5 font-medium transition-colors ${
              isLengthValid ? 'text-emerald-600' : 'text-slate-400'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Mínimo de 6 caracteres na senha</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium transition-colors ${
              isMatchValid ? 'text-emerald-600' : 'text-slate-400'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>As duas senhas são iguais</span>
            </div>
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 animate-fade-in font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-5 rounded-xl bg-[#1d5b79] hover:bg-[#144258] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#1d5b79]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Criando conta e enviando dados...</span>
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
              className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Voltar ao formulário
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
