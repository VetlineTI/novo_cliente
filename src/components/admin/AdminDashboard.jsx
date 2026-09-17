import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FolderOpen, 
  Folder, 
  LogOut, 
  RefreshCw, 
  Eye, 
  Phone, 
  Mail, 
  FileText, 
  ShieldCheck, 
  ExternalLink, 
  ChevronRight, 
  Sparkles, 
  ArrowUpDown, 
  Download,
  Briefcase,
  Tag,
  Receipt
} from 'lucide-react';
import logoImg from '../../assets/vetline-logo.png';
import { fetchClients, updateClientStatus, updateClientData } from '../../lib/supabase';
import { ClientDetailModal } from './ClientDetailModal';
import { UserManagementView } from './UserManagementView';
import { Users } from 'lucide-react';

export const AdminDashboard = ({ adminUser, onLogout, onNavigateToPortal }) => {
  const [activeMainTab, setActiveMainTab] = useState('cadastros'); // 'cadastros' | 'usuarios'
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatusTab, setSelectedStatusTab] = useState('pendente'); // Padrão: Pendente
  const [personTypeFilter, setPersonTypeFilter] = useState('todos'); // 'todos', 'PJ', 'PF'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchClients();
      if (res.success) {
        setClients(res.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Atualização completa dos dados do cliente (incluindo tab_pre, tp_ped, cd_vend, endereço, etc.)
  const handleUpdateClient = async (clientId, updatedData) => {
    try {
      const res = await updateClientData(clientId, updatedData);
      if (res && res.success && res.data) {
        setClients((prev) => 
          prev.map((c) => (c.id === clientId ? { ...c, ...res.data } : c))
        );
        if (selectedClient && selectedClient.id === clientId) {
          setSelectedClient((prev) => ({ ...prev, ...res.data }));
        }
        return res;
      }
    } catch (err) {
      console.error('Erro ao atualizar cadastro do cliente no banco:', err);
      throw err;
    }
  };

  // Atualização do status de um cliente
  const handleUpdateStatus = async (clientId, newStatus, notes) => {
    return handleUpdateClient(clientId, { status: newStatus, notes });
  };

  const handleOpenClient = (client) => {
    setSelectedClient(client);
    setIsDetailOpen(true);
  };

  // Métricas de contagem
  const counts = {
    total: clients.length,
    pendente: clients.filter((c) => c.status === 'pendente' || !c.status).length,
    em_analise: clients.filter((c) => c.status === 'em_analise').length,
    aprovado: clients.filter((c) => c.status === 'aprovado').length,
    recusado: clients.filter((c) => c.status === 'recusado').length,
  };

  // Filtragem dos clientes na tela
  const filteredClients = clients.filter((c) => {
    // 1. Filtro de Status
    if (selectedStatusTab !== 'todos') {
      const status = c.status || 'pendente';
      if (status !== selectedStatusTab) return false;
    }

    // 2. Filtro de Tipo de Pessoa
    if (personTypeFilter !== 'todos' && c.person_type !== personTypeFilter) {
      return false;
    }

    // 3. Busca Textual
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchName = c.full_name?.toLowerCase().includes(term);
      const matchTrade = c.trade_name?.toLowerCase().includes(term);
      const matchDoc = c.document_number?.includes(term);
      const matchEmail = c.email?.toLowerCase().includes(term);
      const matchPhone = c.phone?.includes(term);
      const matchCity = c.delivery_city?.toLowerCase().includes(term);
      if (!matchName && !matchTrade && !matchDoc && !matchEmail && !matchPhone && !matchCity) {
        return false;
      }
    }

    return true;
  });

  const countAttachedDocs = (c) => {
    let count = 0;
    if (c.doc_photo_id_url) count++;
    if (c.doc_address_url) count++;
    if (c.doc_contract_url) count++;
    if (c.doc_ie_url) count++;
    return count;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      
      {/* Topo Administrativo */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Título */}
          <div className="flex items-center space-x-3.5">
            <img 
              src={logoImg} 
              alt="Vetline Logo" 
              className="h-9 sm:h-10 w-auto object-contain brightness-110" 
            />
            <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">
                  Painel de Cadastros
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-green/20 text-brand-green border border-brand-green/40">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Vetline Distribuidora de Produtos Veterinários
              </p>
            </div>
          </div>

          {/* Abas de Navegação Superior: Cadastros vs Gestão de Usuários */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveMainTab('cadastros')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeMainTab === 'cadastros'
                  ? 'bg-brand-green text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Cadastros</span>
            </button>

            <button
              onClick={() => setActiveMainTab('usuarios')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeMainTab === 'usuarios'
                  ? 'bg-brand-green text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Usuários &amp; Perfis</span>
              <span className="sm:hidden">Usuários</span>
            </button>
          </div>

          {/* Perfil & Ações do Cabeçalho */}
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToPortal}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-brand-green" />
              <span>Ver Formulário</span>
            </button>

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-white">
                {adminUser?.name || 'Administrador'}
              </span>
              <span className="text-[10px] text-slate-400">
                {adminUser?.email || 'admin@vetline.com.br'}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 text-xs font-bold border border-red-500/30 transition-colors cursor-pointer"
              title="Encerrar Sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* Renderização Condicional da Aba de Gestão de Usuários */}
        {activeMainTab === 'usuarios' ? (
          <UserManagementView />
        ) : (
          <>
            {/* Banner com Métricas de Status */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Pendentes */}
          <div 
            onClick={() => setSelectedStatusTab('pendente')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              selectedStatusTab === 'pendente'
                ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/50 scale-[1.02]'
                : 'bg-white text-slate-800 border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                selectedStatusTab === 'pendente' ? 'text-amber-100' : 'text-slate-500'
              }`}>
                Pendentes
              </span>
              <Clock className={`w-5 h-5 ${
                selectedStatusTab === 'pendente' ? 'text-white' : 'text-amber-500'
              }`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black">{counts.pendente}</span>
              <span className={`text-xs font-medium ${
                selectedStatusTab === 'pendente' ? 'text-amber-100' : 'text-slate-400'
              }`}>
                aguardando análise
              </span>
            </div>
          </div>

          {/* Card 2: Em Análise */}
          <div 
            onClick={() => setSelectedStatusTab('em_analise')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              selectedStatusTab === 'em_analise'
                ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400/50 scale-[1.02]'
                : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                selectedStatusTab === 'em_analise' ? 'text-blue-100' : 'text-slate-500'
              }`}>
                Em Análise
              </span>
              <AlertCircle className={`w-5 h-5 ${
                selectedStatusTab === 'em_analise' ? 'text-white' : 'text-blue-500'
              }`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black">{counts.em_analise}</span>
              <span className={`text-xs font-medium ${
                selectedStatusTab === 'em_analise' ? 'text-blue-100' : 'text-slate-400'
              }`}>
                em verificação
              </span>
            </div>
          </div>

          {/* Card 3: Aprovados */}
          <div 
            onClick={() => setSelectedStatusTab('aprovado')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              selectedStatusTab === 'aprovado'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/50 scale-[1.02]'
                : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                selectedStatusTab === 'aprovado' ? 'text-emerald-100' : 'text-slate-500'
              }`}>
                Aprovados
              </span>
              <CheckCircle2 className={`w-5 h-5 ${
                selectedStatusTab === 'aprovado' ? 'text-white' : 'text-emerald-500'
              }`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black">{counts.aprovado}</span>
              <span className={`text-xs font-medium ${
                selectedStatusTab === 'aprovado' ? 'text-emerald-100' : 'text-slate-400'
              }`}>
                liberados para venda
              </span>
            </div>
          </div>

          {/* Card 4: Recusados */}
          <div 
            onClick={() => setSelectedStatusTab('recusado')}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              selectedStatusTab === 'recusado'
                ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-400/50 scale-[1.02]'
                : 'bg-white text-slate-800 border-slate-200 hover:border-red-300 hover:bg-red-50/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                selectedStatusTab === 'recusado' ? 'text-red-100' : 'text-slate-500'
              }`}>
                Recusados
              </span>
              <XCircle className={`w-5 h-5 ${
                selectedStatusTab === 'recusado' ? 'text-white' : 'text-red-500'
              }`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black">{counts.recusado}</span>
              <span className={`text-xs font-medium ${
                selectedStatusTab === 'recusado' ? 'text-red-100' : 'text-slate-400'
              }`}>
                com pendências
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros, Abas e Busca */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          
          {/* Linha 1: Abas de Status */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
              {[
                { id: 'pendente', label: 'Pendentes', count: counts.pendente },
                { id: 'em_analise', label: 'Em Análise', count: counts.em_analise },
                { id: 'aprovado', label: 'Aprovados', count: counts.aprovado },
                { id: 'recusado', label: 'Recusados', count: counts.recusado },
                { id: 'todos', label: 'Todos os Cadastros', count: counts.total }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedStatusTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    selectedStatusTab === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedStatusTab === tab.id
                      ? 'bg-brand-green text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Botão de Atualizar Dados */}
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200 ml-auto"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-brand-teal ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>

          {/* Linha 2: Busca e Filtro de Pessoa */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            
            {/* Campo de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Razão Social, Nome, CNPJ, CPF, E-mail ou Telefone..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro PJ / PF */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'PJ', label: 'Pessoa Jurídica' },
                { id: 'PF', label: 'Pessoa Física' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPersonTypeFilter(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    personTypeFilter === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Listagem de Clientes */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Solicitações de Cadastro</span>
                <span className="text-xs font-semibold text-slate-500">
                  ({filteredClients.length} {filteredClients.length === 1 ? 'cliente encontrado' : 'clientes encontrados'})
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Clique em qualquer cliente para abrir as <strong>Pastas de Documentos</strong> anexados e alterar status.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-brand-green mx-auto mb-3" />
              <p className="font-semibold text-sm">Carregando cadastros...</p>
            </div>
          ) : filteredClients.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredClients.map((client) => {
                const isPJ = client.person_type === 'PJ';
                const docCount = countAttachedDocs(client);
                const status = client.status || 'pendente';

                return (
                  <div
                    key={client.id}
                    onClick={() => handleOpenClient(client)}
                    className="p-4 sm:p-5 hover:bg-slate-50 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group border-b border-slate-100 last:border-b-0"
                  >
                    {/* Bloco Esquerdo: Informações do Cliente */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      
                      {/* Ícone de Identificação */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover:scale-105 ${
                        isPJ 
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {isPJ ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>

                      {/* Dados Textuais Organizados */}
                      <div className="min-w-0 flex-1 space-y-1">
                        
                        {/* Linha 1: Tipo, Documento, Nome e Data */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.2 rounded text-[10px] font-black uppercase tracking-wider ${
                            isPJ ? 'bg-indigo-100 text-indigo-900' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {isPJ ? 'PJ' : 'PF'}
                          </span>

                          <span className="font-mono text-xs text-slate-500 font-bold">
                            {client.document_number}
                          </span>

                          <span className="text-slate-300">•</span>

                          <h4 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-brand-dark transition-colors truncate">
                            {client.full_name}
                          </h4>

                          {client.trade_name && (
                            <span className="text-xs text-slate-500 font-medium truncate hidden sm:inline">
                              ({client.trade_name})
                            </span>
                          )}

                          <span className="text-[11px] text-slate-400 ml-auto hidden xl:inline">
                            {new Date(client.created_at || Date.now()).toLocaleDateString('pt-BR')} às {new Date(client.created_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Linha 2: Segmento e Contato */}
                        <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                          <span className="font-semibold text-brand-teal">
                            {client.segment}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-medium text-slate-700">{client.phone}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 truncate max-w-[200px]">{client.email}</span>
                        </div>

                        {/* Linha 3: Tags Comerciais (Vendedor, Tabela, Tipo Pedido) */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                            client.cd_vend === 'ATENA' || !client.cd_vend
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}>
                            <Briefcase className="w-3 h-3 text-brand-green" />
                            <span>Vend: {client.cd_vend || 'ATENA'}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50/80 text-amber-800 border border-amber-200">
                            <Tag className="w-3 h-3 text-amber-600" />
                            <span>Tab: {client.tab_pre || 'VTL01'}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50/80 text-emerald-800 border border-emerald-200">
                            <Receipt className="w-3 h-3 text-emerald-600" />
                            <span>Tp: {client.tp_ped || 'VTL01'}</span>
                          </span>
                        </div>

                      </div>
                    </div>

                    {/* Bloco Direito: Status e Ação */}
                    <div className="flex items-center md:flex-col md:items-end justify-between md:justify-center gap-2.5 flex-shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                      
                      <div className="flex items-center gap-2">
                        {/* Indicador de Documentos */}
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                          <FolderOpen className="w-3.5 h-3.5 text-brand-green" />
                          <span>{docCount} {docCount === 1 ? 'doc' : 'docs'}</span>
                        </div>

                        {/* Badge de Status */}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                          status === 'aprovado'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : status === 'recusado'
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : status === 'em_analise'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            status === 'aprovado' ? 'bg-emerald-500' :
                            status === 'recusado' ? 'bg-red-500' :
                            status === 'em_analise' ? 'bg-blue-500' : 'bg-amber-500 animate-ping'
                          }`}></span>
                          {status === 'aprovado' ? 'Aprovado' :
                           status === 'recusado' ? 'Recusado' :
                           status === 'em_analise' ? 'Em Análise' : 'Pendente'}
                        </span>
                      </div>

                      {/* Botão Abrir */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenClient(client);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-brand-dark text-white text-xs font-bold transition-all shadow-xs group-hover:bg-brand-green cursor-pointer"
                      >
                        <Folder className="w-3.5 h-3.5" />
                        <span>Ver Pastas & Docs</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500">
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="font-bold text-slate-700 text-base">Nenhum cadastro encontrado</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Não há registros com os filtros atuais selecionados ({selectedStatusTab !== 'todos' ? `Status: ${selectedStatusTab}` : ''}).
              </p>
            </div>
          )}
        </div>
        </>
        )}
      </main>

      {/* Modal de Detalhes do Cliente com Pastas de Documentos e Edição */}
      <ClientDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        client={selectedClient}
        onUpdateStatus={handleUpdateStatus}
        onUpdateClient={handleUpdateClient}
      />
    </div>
  );
};
