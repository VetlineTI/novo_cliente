import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  LogOut, 
  RefreshCw, 
  Save, 
  Loader2, 
  ExternalLink, 
  Eye, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle, 
  Briefcase, 
  Trash2,
  FileCheck
} from 'lucide-react';
import { 
  getClientSession, 
  logoutClient, 
  updateClientProfile, 
  reuploadClientDocument,
  fetchClientRecord 
} from '../../lib/clientAuth';
import { DocumentViewerModal } from '../admin/DocumentViewerModal';
import { SegmentHelpModal } from '../SegmentHelpModal';
import { maskPhone, maskCEP, maskCPF, maskCNPJ } from '../../utils/masks';
import { fetchAddressByCEP } from '../../utils/validators';

export const ClientDashboard = ({ onLogout }) => {
  const session = getClientSession();
  const [client, setClient] = useState(() => session?.client || {});
  const [activeTab, setActiveTab] = useState('dados'); // 'dados' | 'documentos' | 'suporte'
  
  // Estados de edição de dados cadastrais
  const [fullName, setFullName] = useState(client.full_name || '');
  const [tradeName, setTradeName] = useState(client.trade_name || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [email, setEmail] = useState(client.email || '');
  const [segment, setSegment] = useState(client.segment || '');
  
  // Endereço Principal
  const [zipcode, setZipcode] = useState(client.zipcode || '');
  const [street, setStreet] = useState(client.street || '');
  const [number, setNumber] = useState(client.number || '');
  const [neighborhood, setNeighborhood] = useState(client.neighborhood || '');
  const [complement, setComplement] = useState(client.complement || '');
  const [city, setCity] = useState(client.city || '');
  const [state, setState] = useState(client.state || '');
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState('');

  // Endereço de Entrega
  const [hasDifferentDelivery, setHasDifferentDelivery] = useState(Boolean(client.has_different_delivery_address));
  const [deliveryZipcode, setDeliveryZipcode] = useState(client.delivery_zipcode || '');
  const [deliveryStreet, setDeliveryStreet] = useState(client.delivery_street || '');
  const [deliveryNumber, setDeliveryNumber] = useState(client.delivery_number || '');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState(client.delivery_neighborhood || '');
  const [deliveryComplement, setDeliveryComplement] = useState(client.delivery_complement || '');
  const [deliveryCity, setDeliveryCity] = useState(client.delivery_city || '');
  const [deliveryState, setDeliveryState] = useState(client.delivery_state || '');
  const [loadingDeliveryCep, setLoadingDeliveryCep] = useState(false);

  // Estados de salvamento e feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reenvio de documentos
  const [uploadingField, setUploadingField] = useState(null);
  const [uploadSuccessField, setUploadSuccessField] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [viewerDoc, setViewerDoc] = useState(null);
  const [showSegmentModal, setShowSegmentModal] = useState(false);

  // Sincroniza dados com o banco ao carregar
  const refreshClientData = async () => {
    setIsRefreshing(true);
    try {
      const current = getClientSession();
      if (current?.email || current?.authUserId) {
        const fresh = await fetchClientRecord(current.authUserId, current.email);
        if (fresh) {
          setClient(fresh);
          setFullName(fresh.full_name || '');
          setTradeName(fresh.trade_name || '');
          setPhone(fresh.phone || '');
          setEmail(fresh.email || '');
          setSegment(fresh.segment || '');
          setZipcode(fresh.zipcode || '');
          setStreet(fresh.street || '');
          setNumber(fresh.number || '');
          setNeighborhood(fresh.neighborhood || '');
          setComplement(fresh.complement || '');
          setCity(fresh.city || '');
          setState(fresh.state || '');
          setHasDifferentDelivery(Boolean(fresh.has_different_delivery_address));
          setDeliveryZipcode(fresh.delivery_zipcode || '');
          setDeliveryStreet(fresh.delivery_street || '');
          setDeliveryNumber(fresh.delivery_number || '');
          setDeliveryNeighborhood(fresh.delivery_neighborhood || '');
          setDeliveryComplement(fresh.delivery_complement || '');
          setDeliveryCity(fresh.delivery_city || '');
          setDeliveryState(fresh.delivery_state || '');
        }
      }
    } catch (e) {
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshClientData();
  }, []);

  // Busca CEP Principal
  const handleCepChange = async (e) => {
    const rawVal = e.target.value;
    const formatted = maskCEP(rawVal);
    setZipcode(formatted);
    setCepError('');

    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetchAddressByCEP(clean);
        if (res && !res.erro) {
          if (res.street) setStreet(res.street);
          if (res.neighborhood) setNeighborhood(res.neighborhood);
          if (res.city) setCity(res.city);
          if (res.state) setState(res.state);
        } else {
          setCepError('CEP não localizado.');
        }
      } catch (err) {
        setCepError('Erro ao consultar CEP.');
      } finally {
        setLoadingCep(false);
      }
    }
  };

  // Busca CEP Entrega
  const handleDeliveryCepChange = async (e) => {
    const rawVal = e.target.value;
    const formatted = maskCEP(rawVal);
    setDeliveryZipcode(formatted);

    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8) {
      setLoadingDeliveryCep(true);
      try {
        const res = await fetchAddressByCEP(clean);
        if (res && !res.erro) {
          if (res.street) setDeliveryStreet(res.street);
          if (res.neighborhood) setDeliveryNeighborhood(res.neighborhood);
          if (res.city) setDeliveryCity(res.city);
          if (res.state) setDeliveryState(res.state);
        }
      } catch (err) {
        // ignore
      } finally {
        setLoadingDeliveryCep(false);
      }
    }
  };

  // Salva Alterações Cadastrais
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError('');

    try {
      const updatePayload = {
        full_name: fullName,
        trade_name: tradeName || null,
        phone,
        email,
        segment,
        zipcode,
        street,
        number,
        neighborhood,
        complement: complement || null,
        city,
        state,
        has_different_delivery_address: hasDifferentDelivery,
        delivery_zipcode: hasDifferentDelivery ? deliveryZipcode : null,
        delivery_street: hasDifferentDelivery ? deliveryStreet : null,
        delivery_number: hasDifferentDelivery ? deliveryNumber : null,
        delivery_neighborhood: hasDifferentDelivery ? deliveryNeighborhood : null,
        delivery_complement: hasDifferentDelivery ? deliveryComplement : null,
        delivery_city: hasDifferentDelivery ? deliveryCity : null,
        delivery_state: hasDifferentDelivery ? deliveryState : null,
      };

      const res = await updateClientProfile(client.id, updatePayload);

      if (res.success) {
        setSaveSuccess(true);
        setClient((prev) => ({ ...prev, ...updatePayload }));
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setSaveError(res.error || 'Não foi possível salvar as alterações.');
      }
    } catch (err) {
      setSaveError('Erro ao comunicar com o servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  // Upload e reenvio de documento
  const handleFileReupload = async (e, fieldName, folder, title) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(fieldName);
    setUploadSuccessField(null);
    setUploadError('');

    try {
      const res = await reuploadClientDocument(
        client.id, 
        file, 
        folder, 
        client.document_number, 
        fieldName
      );

      if (res.success && res.url) {
        setUploadSuccessField(fieldName);
        setClient((prev) => ({ ...prev, [fieldName]: res.url }));
        setTimeout(() => setUploadSuccessField(null), 4000);
      } else {
        setUploadError(res.error || `Erro ao reenviar o arquivo ${title}.`);
      }
    } catch (err) {
      setUploadError('Erro ao enviar documento. Verifique o tamanho do arquivo.');
    } finally {
      setUploadingField(null);
      e.target.value = '';
    }
  };

  // Configuração do Status
  const statusConfig = {
    pendente: {
      label: 'Aguardando Análise',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: Clock,
      step: 1,
      title: 'Seu cadastro está em fila de análise',
      desc: 'Nossa equipe de credenciamento recebeu suas informações e documentos. O processo de validação é realizado em até 24 horas úteis.'
    },
    em_analise: {
      label: 'Em Análise',
      badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
      icon: RefreshCw,
      step: 2,
      title: 'Cadastro em análise por nossos analistas',
      desc: 'Estamos checando seus dados e documentos anexados junto à Receita Federal e órgãos regulatórios.'
    },
    aprovado: {
      label: 'Cadastro Aprovado',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      icon: CheckCircle2,
      step: 3,
      title: 'Parabéns! Seu credenciamento foi aprovado',
      desc: 'Sua conta está liberada para pedidos com condições comerciais exclusivas e tabela oficial Vetline.'
    },
    recusado: {
      label: 'Necessita Correções',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
      icon: XCircle,
      step: 2,
      title: 'Atenção: Seu cadastro requer ajustes',
      desc: 'Identificamos pendências em seus dados ou documentos. Por favor, verifique o parecer da nossa equipe e atualize as informações.'
    }
  };

  const currentStatusKey = client.status || 'pendente';
  const currentStatus = statusConfig[currentStatusKey] || statusConfig.pendente;
  const StatusIcon = currentStatus.icon;

  // Identifica se o cliente é Pessoa Física (PF) ou Jurídica (PJ)
  const isPF = (client.person_type || '').toUpperCase() === 'PF' || 
    (client.document_number && client.document_number.replace(/\D/g, '').length === 11);

  // Lista de documentos exibidos estritamente conforme o tipo de pessoa
  const partnerPhotoUrl = client.doc_photo_id_url || client.doc_identificacao_url;
  const contractUrl = client.doc_contract_url || client.doc_contrato_social_url;
  const addressUrl = client.doc_address_url || client.doc_comprovante_endereco_url;
  const crmvUrl = client.doc_crmv_url;

  const documentCards = isPF ? [
    {
      id: 'doc_crmv',
      fieldName: 'doc_crmv_url',
      title: 'CRMV (Carteira Profissional do Médico Veterinário)',
      folder: 'crmv',
      url: crmvUrl || partnerPhotoUrl,
      required: true,
      requiredBadge: 'Obrigatório',
      desc: 'Carteira Profissional do Médico Veterinário ativa emitida pelo CRMV.'
    },
    {
      id: 'doc_address',
      fieldName: 'doc_comprovante_endereco_url',
      title: 'Comprovante de Endereço (Recente)',
      folder: 'comprovante_endereco',
      url: addressUrl,
      required: true,
      requiredBadge: 'Obrigatório',
      desc: 'Comprovante de residência recente (água, luz, telefone ou internet) emitido em até 90 dias.'
    }
  ] : [
    {
      id: 'doc_contract',
      fieldName: 'doc_contrato_social_url',
      title: 'Contrato Social ou Doc. Constitutivo',
      folder: 'contrato_social',
      url: contractUrl,
      required: !partnerPhotoUrl,
      requiredBadge: contractUrl ? 'Anexado' : (!partnerPhotoUrl ? 'Obrigatório (mínimo 1)' : 'Opcional'),
      desc: 'Contrato Social consolidado, estatuto ou requerimento de empresário registrado na Junta Comercial.'
    },
    {
      id: 'doc_photo_id',
      fieldName: 'doc_identificacao_url',
      title: 'Documento com Foto de um dos Sócios (RG/CNH)',
      folder: 'documento_socios',
      url: partnerPhotoUrl,
      required: !contractUrl,
      requiredBadge: partnerPhotoUrl ? 'Anexado' : (!contractUrl ? 'Obrigatório (mínimo 1)' : 'Opcional'),
      desc: 'RG, CNH ou documento oficial com foto de um dos sócios administradores da empresa.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#f5f8fa] text-slate-800 pb-16">
      
      {/* ========================================================================= */}
      {/* 1. TOPBAR DO PORTAL DO CLIENTE                                            */}
      {/* ========================================================================= */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          
          {/* Identificação do Cliente */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-green-light text-brand-dark flex items-center justify-center font-black text-sm flex-shrink-0 border border-brand-green/30">
              {client.person_type === 'PJ' ? <Building2 className="w-5 h-5 text-brand-green" /> : <User className="w-5 h-5 text-brand-green" />}
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                  {client.full_name || client.trade_name || session?.email || 'Minha Conta'}
                </h1>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border hidden xs:inline-flex items-center gap-1 ${currentStatus.badgeClass}`}>
                  <StatusIcon className={`w-3 h-3 ${currentStatusKey === 'em_analise' && isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{currentStatus.label}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate">
                {client.person_type === 'PJ' ? 'CNPJ: ' : 'CPF: '}
                {client.document_number ? (client.person_type === 'PJ' ? maskCNPJ(client.document_number) : maskCPF(client.document_number)) : 'Cadastrado'}
              </p>
            </div>
          </div>

          {/* Ações de Topo: Atualizar e Sair */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={refreshClientData}
              disabled={isRefreshing}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-green' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                logoutClient();
                if (onLogout) onLogout();
              }}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Encerrar sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        
        {/* ========================================================================= */}
        {/* 2. CARD PRINCIPAL DE STATUS DO CADASTRO                                   */}
        {/* ========================================================================= */}
        <div className={`p-5 sm:p-7 rounded-3xl border shadow-sm transition-all ${
          currentStatusKey === 'aprovado' 
            ? 'bg-gradient-to-br from-emerald-500/10 via-white to-white border-emerald-300' 
            : currentStatusKey === 'recusado'
            ? 'bg-gradient-to-br from-rose-500/10 via-white to-white border-rose-300'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Mensagem e Ícone */}
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
                currentStatusKey === 'aprovado' 
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300' 
                  : currentStatusKey === 'recusado'
                  ? 'bg-rose-100 text-rose-700 border-rose-300'
                  : 'bg-brand-green-light text-brand-dark border-brand-green/30'
              }`}>
                <StatusIcon className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${currentStatus.badgeClass}`}>
                    {currentStatus.label}
                  </span>
                  {client.created_at && (
                    <span className="text-xs text-slate-400">
                      Enviado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {currentStatus.title}
                </h2>
                
                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                  {currentStatus.desc}
                </p>

                {/* Se houver notas do analista */}
                {client.notes && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-950 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Observação da equipe de análise:</span>
                    </p>
                    <p className="leading-relaxed pl-5.5 text-amber-800">{client.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dados Comerciais / Resumo Rápido */}
            {currentStatusKey === 'aprovado' && (
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-center gap-2.5 min-w-[240px]">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Condições Comerciais
                </span>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tabela de Preço</span>
                    <span className="font-bold text-slate-800 font-mono">{client.tab_pre || 'VTL01'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tipo Pedido</span>
                    <span className="font-bold text-slate-800 font-mono">{client.tp_ped || 'VTL01'}</span>
                  </div>
                  <div className="col-span-2 border-t border-emerald-200/60 pt-1.5">
                    <span className="text-slate-400 block text-[10px]">Vendedor Vinculado</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {client.cd_vend && client.cd_vend !== 'ATENA' ? `Vendedor [${client.cd_vend}]` : 'Equipe Vetline (Atena)'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Linha do Tempo / Stepper Visual */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-2 text-center relative">
              
              {/* Etapa 1: Cadastro */}
              <div className="flex flex-col items-center space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-slate-800">1. Cadastro Enviado</span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">Dados e anexos recebidos</span>
              </div>

              {/* Etapa 2: Análise */}
              <div className="flex flex-col items-center space-y-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  currentStatusKey === 'em_analise'
                    ? 'bg-blue-600 text-white animate-pulse'
                    : currentStatusKey === 'aprovado'
                    ? 'bg-emerald-500 text-white'
                    : currentStatusKey === 'recusado'
                    ? 'bg-rose-500 text-white'
                    : 'bg-amber-400 text-white'
                }`}>
                  {currentStatusKey === 'aprovado' ? <CheckCircle className="w-4 h-4" /> : '2'}
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-slate-800">2. Análise Cadastral</span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">Validação e crédito</span>
              </div>

              {/* Etapa 3: Liberação */}
              <div className="flex flex-col items-center space-y-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  currentStatusKey === 'aprovado'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {currentStatusKey === 'aprovado' ? <CheckCircle className="w-4 h-4" /> : '3'}
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-slate-800">3. Acesso Liberado</span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">Tabela e pedidos</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. SELETOR DE ABAS INTERNO                                                */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'dados'
                ? 'bg-[#1d5b79] text-white shadow-md shadow-[#1d5b79]/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Meus Dados Cadastrais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documentos')}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'documentos'
                ? 'bg-[#1d5b79] text-white shadow-md shadow-[#1d5b79]/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documentos & Reenvio de Anexos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suporte')}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'suporte'
                ? 'bg-[#1d5b79] text-white shadow-md shadow-[#1d5b79]/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Atendimento & Suporte</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 4. CONTEÚDO DA ABA: MEUS DADOS CADASTRAIS (EDIÇÃO)                        */}
        {/* ========================================================================= */}
        {activeTab === 'dados' && (
          <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-brand-green" />
                  <span>Informações de Cadastro</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Mantenha seus dados sempre atualizados para emissão de notas e entregas.
                </p>
              </div>

              {saveSuccess && (
                <div className="p-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-1.5 animate-scale-up">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Dados atualizados com sucesso!</span>
                </div>
              )}
            </div>

            {/* Dados Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Documento (CPF / CNPJ) - Somente leitura por segurança */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {client.person_type === 'PJ' ? 'CNPJ' : 'CPF'} (Bloqueado para alteração)
                </label>
                <input
                  type="text"
                  value={client.person_type === 'PJ' ? maskCNPJ(client.document_number || '') : maskCPF(client.document_number || '')}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm font-mono cursor-not-allowed"
                />
              </div>

              {/* Razão Social ou Nome Completo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {client.person_type === 'PJ' ? 'Razão Social' : 'Nome Completo'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all"
                />
              </div>

              {/* Nome Fantasia (PJ) */}
              {client.person_type === 'PJ' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all"
                  />
                </div>
              )}

              {/* Telefone / WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  WhatsApp / Telefone <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all"
                />
              </div>

              {/* E-mail de Faturamento */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  E-mail para Faturamento <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all"
                />
              </div>

              {/* Segmento */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Segmento de Atuação <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSegmentModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-green hover:text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200/60 transition-colors cursor-pointer"
                    title="Dúvida de qual segmento escolher? Clique aqui para abrir o guia explicativo"
                  >
                    <HelpCircle className="w-3 h-3 shrink-0" />
                    <span className="underline decoration-dotted underline-offset-2">Qual escolher?</span>
                  </button>
                </div>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all cursor-pointer"
                >
                  <option value="">Selecione o segmento...</option>
                  <option value="LOJA AGROPECUARIA">LOJA AGROPECUARIA</option>
                  <option value="FORNECEDOR">FORNECEDOR</option>
                  <option value="ATACADISTA">ATACADISTA</option>
                  <option value="BANHO E TOSA">BANHO E TOSA</option>
                  <option value="CLÍNICA COM LOJA">CLÍNICA COM LOJA</option>
                  <option value="CRIADOR">CRIADOR</option>
                  <option value="CRECHE">CRECHE</option>
                  <option value="CLINICA VETERINARIA">CLINICA VETERINARIA</option>
                  <option value="DISTRIBUIDORA">DISTRIBUIDORA</option>
                  <option value="E-COMMERCE">E-COMMERCE</option>
                  <option value="FUNCIONARIO">FUNCIONARIO</option>
                  <option value="HOSPITAL VETERINARIO">HOSPITAL VETERINARIO</option>
                  <option value="HOTEL / CRECHE">HOTEL / CRECHE</option>
                  <option value="INDUSTRIA VLF">INDUSTRIA VLF</option>
                  <option value="INSTITUIÇAO DE ENSINO">INSTITUIÇAO DE ENSINO</option>
                  <option value="LABORATORIO DE EXAMES">LABORATORIO DE EXAMES</option>
                  <option value="PET SHOP COM BANHO E TOSA">PET SHOP COM BANHO E TOSA</option>
                  <option value="PET SHOP COM CLINICA">PET SHOP COM CLINICA</option>
                  <option value="PET SHOP COMPLETO">PET SHOP COMPLETO</option>
                  <option value="ONGs">ONGs</option>
                  <option value="OUTROS SEGMENTOS">OUTROS SEGMENTOS</option>
                  <option value="PREFEITURA">PREFEITURA</option>
                  <option value="ANIMAIS DE PRODUÇAO">ANIMAIS DE PRODUÇAO</option>
                  <option value="PET SHOP GRANEL">PET SHOP GRANEL</option>
                  <option value="PET SHOP COM VETERINARIO">PET SHOP COM VETERINARIO</option>
                  <option value="PET SHOP">PET SHOP</option>
                  <option value="PRODUTOR RURAL">PRODUTOR RURAL</option>
                  <option value="TRANSPORTADORA">TRANSPORTADORA</option>
                  <option value="VETERINARIO AUTONOMO">VETERINARIO AUTONOMO</option>
                </select>
              </div>
            </div>

            {/* Endereço Principal */}
            <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                <MapPin className="w-4 h-4 text-brand-green" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-800">Endereço Principal / Cadastral</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
                {/* CEP */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    CEP *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={zipcode}
                      onChange={handleCepChange}
                      maxLength={9}
                      placeholder="00000-000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                    />
                    {loadingCep && <Loader2 className="w-4 h-4 animate-spin text-brand-teal absolute right-3 top-1/2 -translate-y-1/2" />}
                  </div>
                  {cepError && <p className="text-xs text-amber-600 mt-1">{cepError}</p>}
                </div>

                {/* Rua */}
                <div className="sm:col-span-8">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Rua / Logradouro *
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Av, Rua..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                  />
                </div>

                {/* Número */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Número *
                  </label>
                  <input
                    type="text"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="123"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                  />
                </div>

                {/* Complemento */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Sala, Galpão..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                  />
                </div>

                {/* Bairro */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Bairro *
                  </label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Bairro"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                  />
                </div>

                {/* Cidade */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Cidade"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                  />
                </div>

                {/* UF */}
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    UF *
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    maxLength={2}
                    placeholder="UF"
                    className="w-full px-2 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-white text-center"
                  />
                </div>
              </div>
            </div>

            {/* Endereço de Entrega Alternativo */}
            <div className="bg-slate-50/60 rounded-2xl p-4 sm:p-5 border border-slate-200/70 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasDifferentDelivery}
                  onChange={(e) => setHasDifferentDelivery(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-green focus:ring-brand-green border-slate-300"
                />
                <span className="text-xs sm:text-sm font-bold text-slate-800">
                  Endereço de entrega diferente do endereço cadastral?
                </span>
              </label>

              {hasDifferentDelivery && (
                <div className="pt-3 border-t border-slate-200/80 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">CEP de Entrega</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={deliveryZipcode}
                          onChange={handleDeliveryCepChange}
                          placeholder="00000-000"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                        />
                        {loadingDeliveryCep && <Loader2 className="w-4 h-4 animate-spin text-brand-teal absolute right-3 top-1/2 -translate-y-1/2" />}
                      </div>
                    </div>

                    <div className="sm:col-span-8">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Rua de Entrega</label>
                      <input
                        type="text"
                        value={deliveryStreet}
                        onChange={(e) => setDeliveryStreet(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Número</label>
                      <input
                        type="text"
                        value={deliveryNumber}
                        onChange={(e) => setDeliveryNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Bairro</label>
                      <input
                        type="text"
                        value={deliveryNeighborhood}
                        onChange={(e) => setDeliveryNeighborhood(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade</label>
                      <input
                        type="text"
                        value={deliveryCity}
                        onChange={(e) => setDeliveryCity(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">UF</label>
                      <input
                        type="text"
                        value={deliveryState}
                        onChange={(e) => setDeliveryState(e.target.value.toUpperCase())}
                        maxLength={2}
                        className="w-full px-2 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-white text-center"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mensagem de Erro no Salvamento */}
            {saveError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Botão Salvar Alterações */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="py-3.5 px-6 rounded-xl bg-[#1d5b79] hover:bg-[#144258] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-[#1d5b79]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Salvando alterações...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-emerald-300" />
                    <span>Salvar Alterações Cadastrais</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* 5. CONTEÚDO DA ABA: DOCUMENTOS E REENVIO DE ANEXOS                        */}
        {/* ========================================================================= */}
        {activeTab === 'documentos' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-green" />
                <span>Documentos & Anexos do Credenciamento ({isPF ? 'Pessoa Física' : 'Pessoa Jurídica'})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isPF 
                  ? 'Para Pessoa Física, os documentos exigidos são a Carteira Profissional (CRMV) e o Comprovante de Endereço.'
                  : 'Para Pessoa Jurídica, os documentos exigidos são o Contrato Social e o Documento com Foto de um dos Sócios.'}
              </p>
            </div>

            {uploadError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Grid com Cards dos Documentos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {documentCards.map((doc) => {
                const hasFile = Boolean(doc.url);
                const isUploading = uploadingField === doc.fieldName;
                const isUploadSuccess = uploadSuccessField === doc.fieldName;

                return (
                  <div
                    key={doc.id}
                    className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                      hasFile 
                        ? 'bg-slate-50/60 border-slate-200 hover:border-brand-green/50' 
                        : 'bg-amber-50/30 border-amber-200/80 border-dashed'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            hasFile ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">{doc.title}</h4>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {doc.requiredBadge || (doc.required ? 'Obrigatório' : 'Opcional')}
                            </span>
                          </div>
                        </div>

                        {hasFile ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Anexado</span>
                          </span>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            doc.required 
                              ? 'bg-amber-100 text-amber-800 border-amber-300' 
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}>
                            <AlertCircle className="w-3 h-3" />
                            <span>{doc.required ? 'Pendente' : 'Não enviado'}</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed">
                        {doc.desc}
                      </p>

                      {isUploadSuccess && (
                        <div className="p-2 rounded-lg bg-emerald-100/80 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Arquivo atualizado com sucesso!</span>
                        </div>
                      )}
                    </div>

                    {/* Ações: Visualizar e Reenviar */}
                    <div className="pt-4 mt-3 border-t border-slate-200/70 flex items-center justify-between gap-2 flex-wrap">
                      {hasFile ? (
                        <button
                          type="button"
                          onClick={() => setViewerDoc({
                            title: doc.title,
                            url: doc.url,
                            fileName: `${doc.id}_documento`,
                            category: 'Documento Anexado'
                          })}
                          className="py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-brand-teal" />
                          <span>Visualizar anexo</span>
                        </button>
                      ) : (
                        <span className="text-xs text-amber-700 font-medium">Nenhum arquivo enviado</span>
                      )}

                      {/* Botão de Substituir / Reenviar com input file oculto */}
                      <label className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isUploading 
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-brand-green hover:bg-brand-dark text-white shadow-xs'
                      }`}>
                        {isUploading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>{hasFile ? 'Substituir documento' : 'Enviar documento'}</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          disabled={isUploading}
                          onChange={(e) => handleFileReupload(e, doc.fieldName, doc.folder, doc.title)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 6. CONTEÚDO DA ABA: ATENDIMENTO & SUPORTE                                 */}
        {/* ========================================================================= */}
        {activeTab === 'suporte' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
            
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-green" />
                <span>Canais de Atendimento e Suporte Vetline</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Dúvidas sobre o status do seu cadastro, envio de documentos ou condições de compra? Fale conosco.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Card WhatsApp Oficial */}
              <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                    <Phone className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Atendimento Via WhatsApp</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Fale diretamente com nossa equipe de credenciamento para esclarecer dúvidas ou agilizar a aprovação do seu cadastro.
                  </p>
                </div>

                <a
                  href={`https://wa.me/5500000000000?text=${encodeURIComponent(`Olá! Sou o cliente ${client.full_name || ''} (Doc: ${client.document_number || ''}) e gostaria de informações sobre meu cadastro na Vetline.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>Conversar no WhatsApp</span>
                </a>
              </div>

              {/* Card Informações da Empresa */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Vetline Distribuidora</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Distribuição especializada de medicamentos, vacinas e produtos veterinários em todo o território nacional.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-green flex-shrink-0" />
                    <span>Horário de Atendimento: Seg a Sex, das 08h às 18h</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-brand-teal flex-shrink-0" />
                    <span>contato@vetline.com.br</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Visualizador Modal de Documentos */}
      {viewerDoc && (
        <DocumentViewerModal
          isOpen={Boolean(viewerDoc)}
          onClose={() => setViewerDoc(null)}
          document={viewerDoc}
        />
      )}

      {/* Modal de Ajuda de Segmento */}
      <SegmentHelpModal
        isOpen={showSegmentModal}
        onClose={() => setShowSegmentModal(false)}
        currentValue={segment}
        onSelectSegment={(val) => setSegment(val)}
      />
    </div>
  );
};
