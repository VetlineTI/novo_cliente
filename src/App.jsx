import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LeftSidebar } from './components/LeftSidebar';
import { RegistrationForm } from './components/RegistrationForm';
import { SuccessModal } from './components/SuccessModal';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { getAdminSession, logoutAdmin } from './lib/adminAuth';
import { ShieldCheck, Lock } from 'lucide-react';

export function App() {
  const [successData, setSuccessData] = useState(null);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [formKey, setFormKey] = useState(1);
  
  // Controle de Rota: 'portal' ou 'admin'
  const isInitialAdmin = 
    typeof window !== 'undefined' && 
    (window.location.pathname.toLowerCase().startsWith('/admin') || 
     window.location.search.includes('admin') || 
     window.location.hash.includes('admin'));

  const [currentRoute, setCurrentRoute] = useState(isInitialAdmin ? 'admin' : 'portal');
  const [adminUser, setAdminUser] = useState(() => getAdminSession());

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

  const handleLoginSuccess = (user) => {
    setAdminUser(user);
  };

  const handleLogout = () => {
    logoutAdmin();
    setAdminUser(null);
  };

  const handleSuccess = (submittedData) => {
    setSuccessData(submittedData);
    setIsSuccessOpen(true);
  };

  const handleResetForm = () => {
    setSuccessData(null);
    setFormKey((prev) => prev + 1);
  };

  // ============================================================================
  // ROTA ADMINISTRATIVA (/admin)
  // ============================================================================
  if (currentRoute === 'admin') {
    if (!adminUser) {
      return (
        <AdminLogin
          onLoginSuccess={handleLoginSuccess}
          onBackToPortal={navigateToPortal}
        />
      );
    }

    return (
      <AdminDashboard
        adminUser={adminUser}
        onLogout={handleLogout}
        onNavigateToPortal={navigateToPortal}
      />
    );
  }

  // ============================================================================
  // ROTA PÚBLICA: PORTAL DE CADASTRO DO CLIENTE (/)
  // ============================================================================
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8fa] text-slate-800 selection:bg-brand-green selection:text-white">
      {/* Cabeçalho Oficial */}
      <Header onNavigateToAdmin={navigateToAdmin} />

      {/* Conteúdo Central: Layout Responsivo com Sidebar + Formulário */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12 items-start">

          {/* Coluna Esquerda: Apresentação & Benefícios Vetline */}
          <div className="lg:col-span-5 xl:col-span-5 order-2 lg:order-1">
            <LeftSidebar />
          </div>

          {/* Coluna Direita: Formulário de Cadastro */}
          <div className="lg:col-span-7 xl:col-span-7 order-1 lg:order-2">
            <RegistrationForm key={formKey} onSuccess={handleSuccess} />
          </div>
        </div>
      </main>

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
            <span>•</span>
            <button
              onClick={navigateToAdmin}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3 text-brand-green" />
              <span>Acesso Administrativo</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modal de Sucesso com Confetes e Protocolo */}
      <SuccessModal
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        data={successData}
        onReset={handleResetForm}
      />
    </div>
  );
}

export default App;
