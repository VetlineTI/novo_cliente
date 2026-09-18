import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ClientPortalAuth } from './components/client/ClientPortalAuth';
import { ClientDashboard } from './components/client/ClientDashboard';
import { ResetPasswordModal } from './components/client/ResetPasswordModal';
import { SuccessModal } from './components/SuccessModal';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { getAdminSession, logoutAdmin } from './lib/adminAuth';
import { getClientSession, logoutClient } from './lib/clientAuth';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { ShieldCheck, Lock, ExternalLink } from 'lucide-react';

export function App() {
  const [successData, setSuccessData] = useState(null);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  // Sessão do Cliente
  const [clientSession, setClientSession] = useState(() => getClientSession());

  // Controle de Rota: 'portal' ou 'admin'
  const isInitialAdmin =
    typeof window !== 'undefined' &&
    (window.location.pathname.toLowerCase().startsWith('/admin') ||
      window.location.search.includes('admin') ||
      window.location.hash.includes('admin'));

  const [currentRoute, setCurrentRoute] = useState(isInitialAdmin ? 'admin' : 'portal');
  const [adminUser, setAdminUser] = useState(() => getAdminSession());

  // Escuta histórico de navegação e evento de recuperação de senha
  useEffect(() => {
    // Detecta se a URL contém parâmetros de recuperação de senha
    const isRecoveryUrl =
      typeof window !== 'undefined' &&
      (window.location.search.includes('type=recovery') ||
        window.location.hash.includes('type=recovery') ||
        window.location.search.includes('reset_password=true'));

    if (isRecoveryUrl) {
      setIsResetPasswordOpen(true);
    }

    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsResetPasswordOpen(true);
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe?.();
      };
    }
  }, []);

  // Escuta histórico de navegação (botão voltar/avançar do navegador)
  useEffect(() => {
    const handlePopState = () => {
      const isAdminPath =
        window.location.pathname.toLowerCase().startsWith('/admin') ||
        window.location.search.includes('admin') ||
        window.location.hash.includes('admin');

      setCurrentRoute(isAdminPath ? 'admin' : 'portal');
      setAdminUser(getAdminSession());
      setClientSession(getClientSession());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setCurrentRoute('admin');
    setAdminUser(getAdminSession());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToPortal = () => {
    window.history.pushState({}, '', '/');
    setCurrentRoute('portal');
    setClientSession(getClientSession());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handlers do Admin
  const handleAdminLoginSuccess = (user) => {
    setAdminUser(user);
  };

  const handleAdminLogout = () => {
    logoutAdmin();
    setAdminUser(null);
  };

  // Handlers do Cliente
  const handleClientLoginSuccess = (session) => {
    setClientSession(session);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClientLogout = () => {
    logoutClient();
    setClientSession(null);
    navigateToPortal();
  };

  const handleRegistrationSuccess = (submittedData, session) => {
    setSuccessData(submittedData);
    if (session) {
      setClientSession(session);
    }
    setIsSuccessOpen(true);
  };

  const handleSuccessClose = () => {
    setIsSuccessOpen(false);
    // Se tiver sessão de cliente criada, atualiza estado para exibir painel
    const current = getClientSession();
    if (current) {
      setClientSession(current);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================================================
  // ROTA ADMINISTRATIVA (/admin)
  // ============================================================================
  if (currentRoute === 'admin') {
    if (!adminUser) {
      return (
        <AdminLogin
          onLoginSuccess={handleAdminLoginSuccess}
          onBackToPortal={navigateToPortal}
        />
      );
    }

    return (
      <AdminDashboard
        adminUser={adminUser}
        onLogout={handleAdminLogout}
        onNavigateToPortal={navigateToPortal}
      />
    );
  }

  // ============================================================================
  // ROTA DO CLIENTE (/): SE LOGADO MOSTRA DASHBOARD, SE NÃO MOSTRA LOGIN/CADASTRO
  // ============================================================================
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8fa] text-slate-800 selection:bg-brand-green selection:text-white">
      {/* Cabeçalho Oficial com suporte a sessão de cliente */}
      <Header
        onNavigateToAdmin={navigateToAdmin}
        onNavigateToHome={navigateToPortal}
        clientSession={clientSession}
        onLogoutClient={handleClientLogout}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1">
        {clientSession?.isAuthenticated ? (
          /* Cliente Autenticado: Painel & Perfil do Cliente */
          <ClientDashboard
            onLogout={handleClientLogout}
          />
        ) : (
          /* Cliente Não Autenticado: Tela com Abas "Já sou cliente" e "Ainda não sou" */
          <ClientPortalAuth
            onLoginSuccess={handleClientLoginSuccess}
            onRegistrationSuccess={handleRegistrationSuccess}
          />
        )}
      </div>

      {/* Rodapé Moderno */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-medium">
            <span className="font-bold text-slate-700">Vetline Distribuidora</span>
            <span>•</span>
            <span>Todos os direitos reservados &copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
              Proteção de dados LGPD
            </span>
          </div>
        </div>
      </footer>

      {/* Modal de Sucesso com Confetes e Protocolo */}
      <SuccessModal
        isOpen={isSuccessOpen}
        onClose={handleSuccessClose}
        data={successData}
        onReset={() => { }}
      />

      {/* Modal de Redefinição de Senha (via link do e-mail) */}
      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        onSuccess={() => {
          setIsResetPasswordOpen(false);
          navigateToPortal();
        }}
      />
    </div>
  );
}

export default App;
