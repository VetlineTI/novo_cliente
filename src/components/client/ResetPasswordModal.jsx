import React, { useState } from 'react';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight 
} from 'lucide-react';
import { updateUserPassword } from '../../lib/clientAuth';

export const ResetPasswordModal = ({ isOpen, onSuccess, onClose }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPass = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPass) {
      setError('Por favor, informe a nova senha.');
      return;
    }

    if (cleanPass.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const res = await updateUserPassword(cleanPass);

      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || 'Não foi possível redefinir sua senha.');
      }
    } catch (err) {
      setError('Falha ao atualizar a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (onSuccess) {
      onSuccess();
    } else if (onClose) {
      onClose();
    }
  };

  const isLengthValid = password.length >= 6;
  const isMatchValid = password.length > 0 && password === confirmPassword;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden relative animate-scale-up">
        
        {/* Topo / Header da Modal */}
        <div className="p-6 sm:p-7 text-center border-b border-slate-100 bg-linear-to-b from-slate-50/80 to-white space-y-3">
          <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center shadow-md transition-all ${
            success 
              ? 'bg-emerald-100 text-emerald-600 shadow-emerald-500/20' 
              : 'bg-brand-green-light text-brand-green shadow-brand-green/20'
          }`}>
            {success ? <CheckCircle2 className="w-7 h-7 stroke-[2.2]" /> : <KeyRound className="w-7 h-7 stroke-[2.2]" />}
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {success ? 'Senha Redefinida!' : 'Criar Nova Senha'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              {success 
                ? 'Sua nova senha de acesso foi cadastrada com sucesso.' 
                : 'Defina uma nova senha segura para acessar sua conta na Vetline.'}
            </p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 sm:p-7">
          {success ? (
            /* Sucesso */
            <div className="space-y-5 animate-fade-in text-center">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <p className="font-bold text-sm text-emerald-800">Tudo pronto!</p>
                <p className="text-slate-600">
                  Você já pode utilizar sua nova senha para acessar o portal do cliente a qualquer momento.
                </p>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-3.5 px-5 rounded-xl bg-brand-green hover:bg-brand-dark text-white font-bold text-sm shadow-md shadow-brand-green/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Acessar Portal do Cliente</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Formulário de Nova Senha */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Campo Nova Senha */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-brand-teal" />
                  <span>Nova Senha</span>
                  <span className="text-red-500">*</span>
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

              {/* Campo Confirmar Senha */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-brand-teal" />
                  <span>Confirmar Nova Senha</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Repita sua nova senha..."
                    disabled={loading}
                    className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all"
                  />
                </div>
              </div>

              {/* Requisitos */}
              <div className="space-y-1.5 pt-1 text-[11px]">
                <div className={`flex items-center gap-1.5 font-medium transition-colors ${
                  isLengthValid ? 'text-emerald-600' : 'text-slate-400'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Mínimo de 6 caracteres</span>
                </div>
                <div className={`flex items-center gap-1.5 font-medium transition-colors ${
                  isMatchValid ? 'text-emerald-600' : 'text-slate-400'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>As duas senhas são iguais</span>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#1d5b79] hover:bg-[#144258] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#1d5b79]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Salvando nova senha...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-300" />
                      <span>Salvar Nova Senha</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
