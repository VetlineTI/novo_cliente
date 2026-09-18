import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  Sparkles,
  ShieldCheck,
  Building2,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { ClientLogin } from './ClientLogin';
import { RegistrationForm } from '../RegistrationForm';
import { LeftSidebar } from '../LeftSidebar';

export const ClientPortalAuth = ({ 
  onLoginSuccess, 
  onRegistrationSuccess, 
  initialTab = 'register',
  activationSuccessMessage = '',
  initialLoginEmail = ''
}) => {
  const [activeTab, setActiveTab] = useState(initialTab); // 'register' | 'login'

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="w-full">
      {/* Banner / Seletor de Abas Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-4">

        {/* Seletor de Abas Estilizado */}
        <div className="flex justify-center">
          <div className="bg-white/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-md backdrop-blur-xs flex items-center gap-1.5 max-w-md w-full">

            {/* Aba 1: Ainda não sou cliente (Principal) */}
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'register'
                ? 'bg-brand-green text-white shadow-md shadow-brand-green/25 scale-[1.01]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
            >
              <UserPlus className="w-4 h-4 text-white" />
              <span>Ainda não sou</span>
            </button>

            {/* Aba 2: Já sou cliente */}
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'login'
                ? 'bg-[#1d5b79] text-white shadow-md shadow-[#1d5b79]/25 scale-[1.01]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
            >
              <LogIn className="w-4 h-4 text-emerald-300" />
              <span>Já sou cliente</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Dinâmico com base na aba selecionada */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'login' ? (
          /* ========================================================================= */
          /* ABA 1: JÁ SOU CLIENTE (LOGIN)                                             */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto animate-fade-in">

            {/* Coluna Informativa Lateral para Login */}
            <div className="lg:col-span-5 space-y-6 hidden lg:block">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-green-light border border-brand-green/40 text-brand-dark text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-brand-green" />
                  <span>Portal de Acesso Vetline</span>
                </div>

                <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  Acompanhe seu cadastro
                </h2>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Acesse sua conta para consultar o status da sua aprovação, atualizar endereços e gerenciar seus documentos.
                </p>
              </div>

              {/* Benefícios Rápidos */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">Acompanhamento de status em tempo real</span>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">Reenvio de anexos e documentos em 1 clique</span>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">Edição e manutenção cadastral simplificada</span>
                </div>
              </div>
            </div>

            {/* Coluna do Formulário de Login */}
            <div className="lg:col-span-7">
              <ClientLogin
                onLoginSuccess={onLoginSuccess}
                onSwitchToRegister={() => setActiveTab('register')}
                activationSuccessMessage={activationSuccessMessage}
                initialEmail={initialLoginEmail}
              />
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* ABA 2: AINDA NÃO SOU CLIENTE (FORMULÁRIO DE CADASTRO)                     */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start animate-fade-in">

            {/* Coluna Esquerda: Apresentação & Benefícios Vetline */}
            <div className="lg:col-span-5 xl:col-span-5 order-2 lg:order-1">
              <LeftSidebar />
            </div>

            {/* Coluna Direita: Formulário de Cadastro com Criação de Senha */}
            <div className="lg:col-span-7 xl:col-span-7 order-1 lg:order-2">
              <RegistrationForm onSuccess={onRegistrationSuccess} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
