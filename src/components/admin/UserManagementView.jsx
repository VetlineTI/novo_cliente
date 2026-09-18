import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Search,
  Mail,
  User,
  Crown,
  Database,
  Shield,
  Ban,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import {
  fetchAuthUsersWithProfiles,
  setUserRole,
  ROLE_DEFINITIONS
} from '../../lib/adminAuth';

export const UserManagementView = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('todos'); // 'todos', 'admin', 'operador', 'consulta', 'bloqueado'

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20); // 20 usuários por página

  // Feedback
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setActionError('');
    try {
      const res = await fetchAuthUsersWithProfiles();
      if (res.success) {
        setUsers(res.data || []);
      }
    } catch (err) {
      setActionError('Falha ao conectar e carregar usuários do Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Reseta para a página 1 ao alterar filtros ou busca
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRoleFilter, itemsPerPage]);

  // Alteração direta do perfil de um usuário
  const handleRoleChange = async (userId, newRole, userName = '') => {
    setUpdatingUserId(userId);
    setActionSuccess('');
    setActionError('');
    try {
      const res = await setUserRole(userId, newRole, userName);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? {
            ...u,
            role: newRole,
            is_admin: newRole === 'admin',
            has_profile: true
          } : u))
        );

        const roleLabel = ROLE_DEFINITIONS[newRole]?.label || newRole.toUpperCase();
        setActionSuccess(`Perfil de acesso atualizado para "${roleLabel}" com sucesso!`);
        setTimeout(() => setActionSuccess(''), 4000);
      } else {
        setActionError(res.error || 'Erro ao atualizar perfil do usuário no Supabase.');
      }
    } catch (err) {
      setActionError('Erro ao salvar nova permissão no Supabase.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Filtragem dos usuários na lista
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Filtro de Role
      if (selectedRoleFilter !== 'todos') {
        const userRole = u.role || 'bloqueado';
        if (selectedRoleFilter === 'admin' && !(u.is_admin || userRole === 'admin')) return false;
        if (selectedRoleFilter === 'operador' && userRole !== 'operador') return false;
        if (selectedRoleFilter === 'consulta' && userRole !== 'consulta') return false;
        if (selectedRoleFilter === 'bloqueado' && userRole !== 'bloqueado') return false;
      }

      // Filtro de Texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchEmail = u.email?.toLowerCase().includes(term);
        const matchName = u.full_name?.toLowerCase().includes(term);
        const matchRole = u.role?.toLowerCase().includes(term);
        const matchId = u.id?.toLowerCase().includes(term);
        if (!matchEmail && !matchName && !matchRole && !matchId) return false;
      }

      return true;
    });
  }, [users, selectedRoleFilter, searchTerm]);

  // Cálculos de Paginação
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentPaginatedUsers = useMemo(() => {
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, startIndex, endIndex]);

  // Contadores
  const adminCount = users.filter((u) => u.is_admin || u.role === 'admin').length;
  const operatorCount = users.filter((u) => u.role === 'operador').length;
  const unassignedCount = users.filter((u) => !u.role || u.role === 'bloqueado').length;

  // Gerador de botões de página (com ellipsis)
  const getPaginationNumbers = () => {
    const pages = [];
    const delta = 2; // Quantas páginas mostrar em volta da página atual

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  return (
    <div className="space-y-6">

      {/* Topo com Estatísticas de Usuários & Perfis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Total de Usuários no Banco */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Usuários</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{users.length}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">cadastrados no Supabase</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Database className="w-6 h-6 text-brand-dark" />
          </div>
        </div>

        {/* Administradores */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Perfil Administrador (ADM)</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-900">{adminCount}</span>
            <span className="text-[11px] text-emerald-600 block mt-0.5">Acesso total e gestão</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Crown className="w-6 h-6" />
          </div>
        </div>

        {/* Operadores */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">Perfil Operador</span>
            <span className="text-2xl sm:text-3xl font-black text-blue-900">{operatorCount}</span>
            <span className="text-[11px] text-blue-600 block mt-0.5">Análise e notas de clientes</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Bloqueados / Sem Autorização */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Sem Acesso / Não Autorizados</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-900">{unassignedCount}</span>
            <span className="text-[11px] text-amber-600 block mt-0.5">Aguardam concessão de ADM</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Alertas de Notificação */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2.5 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs font-bold flex items-center gap-2.5 shadow-xs animate-shake">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Barra de Ações: Busca + Filtros de Perfil + Botão Conceder ADM */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">

        {/* Campo de Busca */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar usuário por e-mail, nome, ID do Supabase ou perfil..."
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

        {/* Filtros Rápidos por Papel */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar">
          {[
            { id: 'todos', label: `Todos (${users.length})` },
            { id: 'admin', label: `👑 Admins (${adminCount})` },
            { id: 'operador', label: `👤 Operadores (${operatorCount})` },
            { id: 'bloqueado', label: `🚫 Sem Acesso (${unassignedCount})` }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedRoleFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${selectedRoleFilter === f.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Botão de Sincronização / Atualização */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
            title="Sincronizar e buscar usuários existentes no auth.users"
          >
            <RefreshCw className={`w-4 h-4 text-brand-teal ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline font-bold">Buscar no Banco</span>
          </button>
        </div>
      </div>

      {/* Tabela de Usuários & Perfis */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">

        {/* Topo da Tabela com Indicador de Paginação */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-brand-green" />
              <span>Usuários do banco de dados &amp; Regras de Perfil</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Por padrão, usuários iniciam como <strong>Sem Acesso</strong>. Selecione qualquer usuário e conceda o perfil de <strong>Administrador (ADM)</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            {/* Seletor de Itens por Página */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="hidden sm:inline">Exibir:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value={10}>10 por pág.</option>
                <option value={20}>20 por pág.</option>
                <option value={50}>50 por pág.</option>
                <option value={100}>100 por pág.</option>
              </select>
            </div>

            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
              {totalItems > 0 ? `${startIndex + 1}-${endIndex} de ${totalItems}` : '0 usuários'}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-green mx-auto mb-3" />
            <p className="font-semibold text-sm">Consultando usuários do Supabase Auth...</p>
          </div>
        ) : currentPaginatedUsers.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Usuário / Identificação</th>
                    <th className="px-5 py-3.5">E-mail no Supabase</th>
                    <th className="px-5 py-3.5">Perfil / Regra Atual</th>
                    <th className="px-5 py-3.5">Autorização de Login</th>
                    <th className="px-5 py-3.5 text-right">Ação Rápida de Perfil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentPaginatedUsers.map((user) => {
                    const isAdmin = user.is_admin || user.role === 'admin';
                    const isOperator = user.role === 'operador';
                    const isConsulta = user.role === 'consulta';
                    const isBlocked = !user.role || user.role === 'bloqueado';
                    const isUpdating = updatingUserId === user.id;

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">

                        {/* Nome e Avatar */}
                        <td className="px-5 py-4 font-bold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs uppercase flex-shrink-0 ${isAdmin
                              ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-300/60'
                              : isOperator
                                ? 'bg-blue-100 text-blue-800'
                                : isConsulta
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                              {isAdmin ? '👑' : user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-slate-900 font-bold truncate">
                                {user.full_name || user.email?.split('@')[0] || 'Usuário Supabase'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block truncate">
                                ID: {user.id?.slice(0, 18)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* E-mail */}
                        <td className="px-5 py-4 font-mono font-medium text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{user.email}</span>
                          </div>
                        </td>

                        {/* Badge do Perfil */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] border ${isAdmin
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : isOperator
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : isConsulta
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                            {isAdmin && <Crown className="w-3.5 h-3.5 text-yellow-500" />}
                            {isOperator && <UserCheck className="w-3.5 h-3.5 text-blue-600" />}
                            {isConsulta && <Eye className="w-3.5 h-3.5 text-slate-500" />}
                            {isBlocked && <Ban className="w-3.5 h-3.5 text-slate-400" />}
                            <span>{ROLE_DEFINITIONS[user.role]?.label || (isAdmin ? 'Administrador (ADM)' : 'Sem Acesso')}</span>
                          </span>
                        </td>

                        {/* Status de Acesso */}
                        <td className="px-5 py-4">
                          {!isBlocked ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span>Liberado para Acesso</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                              <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                              <span>Não Autorizado</span>
                            </span>
                          )}
                        </td>

                        {/* Ações Rápidas: Seletor ou Botão de Tornar ADM */}
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2 justify-end">

                            {/* Se NÃO for admin, botão direto para Tornar Administrador em 1 clique */}
                            {!isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleRoleChange(user.id, 'admin', user.full_name)}
                                disabled={isUpdating}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                title="Conceder perfil de Administrador imediatamente"
                              >
                                <Crown className="w-3 h-3 text-yellow-300" />
                                <span>Dar Perfil ADM</span>
                              </button>
                            )}

                            {/* Seletor de Perfil Completo */}
                            <select
                              value={user.role || (user.is_admin ? 'admin' : 'bloqueado')}
                              onChange={(e) => handleRoleChange(user.id, e.target.value, user.full_name)}
                              disabled={isUpdating}
                              className="text-xs font-bold py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 hover:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green cursor-pointer disabled:opacity-50"
                            >
                              <option value="admin">👑 Administrador (Acesso Total)</option>
                              <option value="operador">👤 Operador (Análise e Notas)</option>
                              <option value="consulta">👁️ Consulta (Somente Leitura)</option>
                              <option value="bloqueado">🚫 Bloquear / Sem Acesso</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Barra de Paginação */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <span className="text-xs text-slate-500 font-medium">
                Página <strong className="text-slate-800">{currentPage}</strong> de <strong className="text-slate-800">{totalPages}</strong> ({totalItems} usuários filtrados)
              </span>

              <div className="flex items-center gap-1">
                {/* Primeira Página */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  title="Primeira Página"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Página Anterior */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  title="Página Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Números das Páginas */}
                <div className="flex items-center gap-1 px-1">
                  {getPaginationNumbers().map((item, idx) => {
                    if (item === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2 text-xs text-slate-400 font-bold">
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={`page-${item}`}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${currentPage === item
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>

                {/* Próxima Página */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  title="Próxima Página"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Última Página */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  title="Última Página"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-700 text-base">Nenhum usuário encontrado</h4>
            <p className="text-xs text-slate-400 mt-1">
              Nenhum usuário corresponde aos filtros ou busca informados.
            </p>
          </div>
        )}
      </div>

      {/* Estrutura de Perfis */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
        <h4 className="text-xs sm:text-sm font-bold text-brand-green uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Estrutura de Perfis e Permissões do Sistema</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-emerald-500/30">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
              <Crown className="w-3.5 h-3.5" />
              <span>1. Administrador (ADM)</span>
            </span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Acesso irrestrito a todas as pastas de documentos, aprovação e recusa de clientes, além de gerenciar outros usuários e conceder perfis.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-blue-500/30">
            <span className="font-bold text-blue-400 flex items-center gap-1.5 mb-1">
              <UserCheck className="w-3.5 h-3.5" />
              <span>2. Operador de Cadastros</span>
            </span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Pode visualizar documentos anexados, registrar notas internas e alterar cadastros para o status "Em Análise".
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
            <span className="font-bold text-slate-400 flex items-center gap-1.5 mb-1">
              <Ban className="w-3.5 h-3.5 text-slate-400" />
              <span>3. Sem Acesso (Padrão)</span>
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Usuários cadastrados no banco iniciam sem permissão até que um Administrador altere ou clique em "Dar Perfil ADM" na tabela.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
