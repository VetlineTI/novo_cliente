import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LeftSidebar } from './components/LeftSidebar';
import { RegistrationForm } from './components/RegistrationForm';
import { SuccessModal } from './components/SuccessModal';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { getAdminSession, logoutAdmin } from './lib/adminAuth';
import { ShieldCheck, Cookie, CheckCircle } from 'lucide-react';
import { TermsModal } from './components/TermsModal';
import { CookieConsentBanner } from './components/CookieConsentBanner';

export function App() {
  const [successData, setSuccessData] = useState(null);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false);
  const [policyModal, setPolicyModal] = useState({ isOpen: false, tab: 'terms' });
  const [formKey, setFormKey] = useState(0);

  // Controle de Rota: 'portal' ou 'admin'
  const isInitialAdmin =
    typeof window !== 'undefined' &&
    (window.location.pathname.toLowerCase().startsWith('/admin') ||
      window.location.search.includes('admin') ||
      window.location.hash.includes('admin'));

  const [currentRoute, setCurrentRoute] = useState(isInitialAdmin ? 'admin' : 'portal');
  const [adminUser, setAdminUser] = useState(() => getAdminSession());

  // Escuta confirmação do link enviado via WhatsApp
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlSearch = window.location.search || '';
    const urlParams = new URLSearchParams(window.location.search);

    const isConfirmed =
      urlParams.get('confirmed') === 'whatsapp' ||
      urlParams.get('activated') === 'true' ||
      urlSearch.includes('confirmed=whatsapp') ||
      urlSearch.includes('activated=true');

    if (isConfirmed) {
      setWhatsappConfirmed(true);
      const emailParam = urlParams.get('email');
      if (emailParam) {
        // Redundância de segurança: garante o processamento da aprovação no servidor
        fetch(`/api/send-whatsapp-signup?action=confirm&email=${encodeURIComponent(emailParam)}`, {
          method: 'POST'
        }).catch(() => {});
      }
      window.history.replaceState({}, '', window.location.pathname);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Handler de Sucesso do Cadastro
  const handleRegistrationSuccess = (submittedData) => {
    setSuccessData(submittedData);
    setIsSuccessOpen(true);
  };

  const handleSuccessClose = () => {
    setIsSuccessOpen(false);
    setSuccessData(null);
    setFormKey(prev => prev + 1); // Força remonte do formulário, limpando todos os campos e uploads
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
  // ROTA DO CLIENTE (/): EXCLUSIVAMENTE A TELA DE FORMULÁRIO DE CADASTRO
  // ============================================================================
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8fa] text-slate-800 selection:bg-brand-green selection:text-white">
      {/* Cabeçalho Oficial */}
      <Header
        onNavigateToAdmin={navigateToAdmin}
        onNavigateToHome={navigateToPortal}
      />

      {/* Conteúdo Principal: Apenas Formulário de Credenciamento */}
      <div className="flex-1">
        {/* Banner de Confirmação do WhatsApp (quando o cliente clica no link do zap) */}
        {whatsappConfirmed && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-sm">🎉 Cadastro confirmado e aprovado com sucesso!</p>
                  <p className="text-xs text-emerald-700 mt-0.5">Seus dados foram integrados ao ERP Vetline e nosso time entrará em contato em breve para dar início ao seu atendimento.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappConfirmed(false)}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">
            {/* Coluna Esquerda: Apresentação & Benefícios Vetline */}
            <div className="lg:col-span-5 xl:col-span-5 order-2 lg:order-1">
              <LeftSidebar />
            </div>

            {/* Coluna Direita: Formulário de Cadastro */}
            <div className="lg:col-span-7 xl:col-span-7 order-1 lg:order-2">
              <RegistrationForm key={formKey} onSuccess={handleRegistrationSuccess} />
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé Moderno com Políticas e LGPD */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-medium">
            <span className="font-bold text-slate-700">Vetline Distribuidora</span>
            <span>•</span>
            <span>Todos os direitos reservados &copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[11px] text-slate-500">
            <button
              type="button"
              onClick={() => setPolicyModal({ isOpen: true, tab: 'terms' })}
              className="hover:text-brand-green hover:underline cursor-pointer transition-colors"
            >
              Termos de Uso
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setPolicyModal({ isOpen: true, tab: 'lgpd' })}
              className="flex items-center gap-1 hover:text-brand-green hover:underline cursor-pointer transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
              Privacidade & LGPD
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setPolicyModal({ isOpen: true, tab: 'cookies' })}
              className="flex items-center gap-1 hover:text-brand-green hover:underline cursor-pointer transition-colors"
            >
              <Cookie className="w-3.5 h-3.5 text-amber-600" />
              Preferências de Cookies
            </button>
          </div>
        </div>
      </footer>

      {/* Banner de Consentimento de Cookies & LGPD */}
      <CookieConsentBanner
        onOpenPolicies={(tab) => setPolicyModal({ isOpen: true, tab: tab || 'cookies' })}
      />

      {/* Central de Políticas (Termos de Uso, LGPD e Cookies) */}
      <TermsModal
        isOpen={policyModal.isOpen}
        onClose={() => setPolicyModal(prev => ({ ...prev, isOpen: false }))}
        initialTab={policyModal.tab}
        showAcceptButton={false}
      />

      {/* Modal de Sucesso com Confetes e Protocolo */}
      <SuccessModal
        isOpen={isSuccessOpen}
        onClose={handleSuccessClose}
        data={successData}
        onReset={handleSuccessClose}
      />
    </div>
  );
}

export default App;
