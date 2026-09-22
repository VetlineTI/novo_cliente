import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  User, 
  Folder, 
  FolderOpen, 
  FileText, 
  Eye, 
  Download, 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Save, 
  ExternalLink,
  ShieldCheck,
  Calendar,
  Truck,
  Briefcase,
  FileCheck2,
  Edit3,
  Check,
  Tag,
  Receipt,
  Loader2,
  Maximize2,
  Search
} from 'lucide-react';
import { DocumentViewerModal } from './DocumentViewerModal';
import { fetchSalespeople } from '../../lib/supabase';
import { executarAuditoriaBureau } from '../../lib/infosimples';

// Segmentos padronizados de mercado
const AVAILABLE_SEGMENTS = [
  'LOJA AGROPECUARIA',
  'FORNECEDOR',
  'ATACADISTA',
  'BANHO E TOSA',
  'CLÍNICA COM LOJA',
  'CRIADOR',
  'CRECHE',
  'CLINICA VETERINARIA',
  'DISTRIBUIDORA',
  'E-COMMERCE',
  'FUNCIONARIO',
  'HOSPITAL VETERINARIO',
  'HOTEL / CRECHE',
  'INDUSTRIA VLF',
  'INSTITUIÇAO DE ENSINO',
  'LABORATORIO DE EXAMES',
  'PET SHOP COM BANHO E TOSA',
  'PET SHOP COM CLINICA',
  'PET SHOP COMPLETO',
  'ONGs',
  'OUTROS SEGMENTOS',
  'PREFEITURA',
  'ANIMAIS DE PRODUÇAO',
  'PET SHOP GRANEL',
  'PET SHOP COM VETERINARIO',
  'PET SHOP',
  'PRODUTOR RURAL',
  'TRANSPORTADORA',
  'VETERINARIO AUTONOMO'
];

export const ClientDetailModal = ({ 
  isOpen, 
  onClose, 
  client, 
  onUpdateStatus,
  onUpdateClient 
}) => {
  const [activeFolder, setActiveFolder] = useState('ficha');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Lista de vendedores para seleção
  const [salespeopleList, setSalespeopleList] = useState([]);
  const [loadingSalespeople, setLoadingSalespeople] = useState(false);

  // Estado dos campos editáveis do cliente
  const [formData, setFormData] = useState({});

  // Estado de consulta do Bureau (Infosimples)
  const [isAuditingBureau, setIsAuditingBureau] = useState(false);
  const [bureauFeedback, setBureauFeedback] = useState(null);

  // Inicializa o formulário com os dados do cliente
  useEffect(() => {
    if (client) {
      setFormData({
        full_name: client.full_name || '',
        trade_name: client.trade_name || '',
        document_number: client.document_number || '',
        phone: client.phone || '',
        email: client.email || '',
        segment: client.segment || '',
        has_ie: Boolean(client.has_ie),
        ie_number: client.ie_number || '',
        zipcode: client.zipcode || '',
        street: client.street || '',
        number: client.number || '',
        neighborhood: client.neighborhood || '',
        complement: client.complement || '',
        city: client.city || '',
        state: client.state || '',
        cd_vend: client.cd_vend || 'ATENA',
        tab_pre: client.tab_pre || 'VTL01',
        tp_ped: client.tp_ped || 'VTL01',
        has_different_delivery_address: Boolean(client.has_different_delivery_address),
        delivery_zipcode: client.delivery_zipcode || '',
        delivery_street: client.delivery_street || '',
        delivery_number: client.delivery_number || '',
        delivery_neighborhood: client.delivery_neighborhood || '',
        delivery_complement: client.delivery_complement || '',
        delivery_city: client.delivery_city || '',
        delivery_state: client.delivery_state || '',
        status: client.status || 'pendente',
        notes: client.notes || ''
      });
      setIsEditing(false);
      setSaveSuccess(false);
    }
  }, [client]);

  // Carrega vendedores da tabela public.vendedor
  useEffect(() => {
    if (isOpen) {
      const loadVends = async () => {
        setLoadingSalespeople(true);
        try {
          const res = await fetchSalespeople();
          if (res.success && res.data) {
            setSalespeopleList(res.data);
          }
        } catch (e) {
        } finally {
          setLoadingSalespeople(false);
        }
      };
      loadVends();
    }
  }, [isOpen]);

  if (!isOpen || !client) return null;

  const isPJ = client.person_type === 'PJ';
  const cleanDoc = client.document_number?.replace(/\D/g, '') || 'geral';
  const bucketName = 'novos_clientes';
  const clientStoragePath = `${bucketName}/${cleanDoc}`;

  // Executa consulta no Bureau da Infosimples sob demanda
  const handleRunBureauAudit = async () => {
    setIsAuditingBureau(true);
    setBureauFeedback(null);
    try {
      const res = await executarAuditoriaBureau(client);
      if (res.success) {
        setBureauFeedback({
          type: 'success',
          message: 'Consulta finalizada com sucesso! Comprovantes anexados.'
        });
        if (onUpdateClient) {
          onUpdateClient({
            ...client,
            doc_receita_url: res.docReceitaUrl || client.doc_receita_url,
            doc_jucesp_url: res.docJucespUrl || client.doc_jucesp_url,
            doc_cenprot_url: res.docCenprotUrl || client.doc_cenprot_url,
            nire_jucesp: res.data?.jucesp?.nire || client.nire_jucesp,
            total_protestos: res.data?.cenprot?.totalProtests ?? client.total_protestos,
            bureau_consulted_at: res.data?.consultedAt || new Date().toISOString()
          });
        }
      } else {
        setBureauFeedback({
          type: 'error',
          message: res.error || 'Erro ao realizar consulta no Bureau.'
        });
      }
    } catch (err) {
      setBureauFeedback({
        type: 'error',
        message: err.message || 'Falha na comunicação com a API Infosimples.'
      });
    } finally {
      setIsAuditingBureau(false);
    }
  };

  // Atualizador de campo individual
  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Salvar todas as alterações no banco de dados
  const handleSaveAll = async (newStatusOverride = null) => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const payloadToSave = {
        ...formData,
        ...(newStatusOverride ? { status: newStatusOverride } : {})
      };

      if (onUpdateClient) {
        await onUpdateClient(client.id, payloadToSave);
      } else if (onUpdateStatus) {
        await onUpdateStatus(client.id, payloadToSave.status, payloadToSave.notes);
      }

      setFormData(payloadToSave);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      alert('Erro ao salvar dados no banco: ' + (err.message || 'Verifique sua conexão'));
    } finally {
      setIsSaving(false);
    }
  };

  // Monta as pastas de documentos organizadas
  const folders = [
    {
      id: 'ficha',
      name: 'Ficha Cadastral & ERP',
      icon: FileText,
      badge: 'Geral',
      hasDocs: true,
      docs: []
    },
    ...(isPJ ? [
      {
        id: 'contrato_social',
        name: 'Contrato Social',
        icon: Building2,
        badge: client.doc_contract_url ? 'Anexado ✓' : 'Pendente',
        hasDocs: Boolean(client.doc_contract_url),
        docs: client.doc_contract_url ? [
          {
            id: 'doc_contract',
            title: 'Contrato Social / Requerimento de Empresário',
            category: 'Empresarial',
            fileName: `contrato_social_${cleanDoc}.pdf`,
            bucket: bucketName,
            path: `${clientStoragePath}/contrato_social/`,
            url: client.doc_contract_url,
            verificationBadge: 'Documento Constitutivo',
            notes: `Armazenado em: ${clientStoragePath}/contrato_social/`
          }
        ] : []
      },
      {
        id: 'socio_identificacao',
        name: 'Doc. do Sócio',
        icon: User,
        badge: client.doc_photo_id_url ? 'Anexado ✓' : 'Pendente',
        hasDocs: Boolean(client.doc_photo_id_url),
        docs: client.doc_photo_id_url ? [
          {
            id: 'doc_photo_id',
            title: 'Documento de Identidade do Sócio (RG / CNH)',
            category: 'Identificação',
            fileName: `documento_socio_${cleanDoc}.jpg`,
            bucket: bucketName,
            path: `${clientStoragePath}/documento_socios/`,
            url: client.doc_photo_id_url,
            verificationBadge: 'Sócio / Representante',
            notes: `Armazenado em: ${clientStoragePath}/documento_socios/`
          }
        ] : []
      },
      ...(client.doc_ie_url ? [
        {
          id: 'ie_fiscal',
          name: 'Inscrição Estadual',
          icon: FileCheck2,
          badge: 'Anexado ✓',
          hasDocs: true,
          docs: [
            {
              id: 'doc_ie',
              title: 'Comprovante de Inscrição Estadual (SINTEGRA / SEFAZ)',
              category: 'Fiscal',
              fileName: `inscricao_estadual_${cleanDoc}.pdf`,
              bucket: bucketName,
              path: `${clientStoragePath}/inscricao_estadual/`,
              url: client.doc_ie_url,
              verificationBadge: 'Inscrição Ativa',
              notes: `Armazenado em: ${clientStoragePath}/inscricao_estadual/`
            }
          ]
        }
      ] : []),
      {
        id: 'bureau_certidoes',
        name: 'Certidões & Bureau',
        icon: Search,
        badge: (client.doc_receita_url || client.doc_jucesp_url || client.doc_cenprot_url) ? 'Consultado ✓' : 'Disponível',
        hasDocs: Boolean(client.doc_receita_url || client.doc_jucesp_url || client.doc_cenprot_url),
        docs: [
          ...(client.doc_receita_url ? [
            {
              id: 'doc_receita',
              title: 'Cartão CNPJ - Receita Federal Oficial (Infosimples)',
              category: 'Receita Federal',
              fileName: `comprovante_cnpj_${cleanDoc}.html`,
              bucket: bucketName,
              path: `${clientStoragePath}/receita_federal/`,
              url: client.doc_receita_url,
              verificationBadge: 'Receita Federal Ativa',
              notes: `Comprovante oficial emitido via Infosimples`
            }
          ] : []),
          ...(client.doc_jucesp_url ? [
            {
              id: 'doc_jucesp',
              title: 'Ficha Cadastral / Registro JUCESP (Infosimples)',
              category: 'Junta Comercial',
              fileName: `jucesp_${cleanDoc}.pdf`,
              bucket: bucketName,
              path: `${clientStoragePath}/jucesp/`,
              url: client.doc_jucesp_url,
              verificationBadge: client.nire_jucesp ? `NIRE: ${client.nire_jucesp}` : 'JUCESP Registrada',
              notes: `Registro oficial na Junta Comercial do Estado de SP`
            }
          ] : []),
          ...(client.doc_cenprot_url ? [
            {
              id: 'doc_cenprot',
              title: 'Certidão / Consulta CENPROT Protestos (Infosimples)',
              category: 'Protestos',
              fileName: `cenprot_${cleanDoc}.pdf`,
              bucket: bucketName,
              path: `${clientStoragePath}/cenprot/`,
              url: client.doc_cenprot_url,
              verificationBadge: client.total_protestos !== null && client.total_protestos !== undefined 
                ? (client.total_protestos === 0 ? '0 Protestos (Nada Consta)' : `${client.total_protestos} Protesto(s)`)
                : 'Consulta CENPROT',
              notes: `Consulta à Central de Protestos de Títulos`
            }
          ] : [])
        ]
      }
    ] : [
      {
        id: 'crmv',
        name: 'CRMV Profissional',
        icon: ShieldCheck,
        badge: (client.doc_crmv_url || client.doc_photo_id_url) ? 'Anexado ✓' : 'Pendente',
        hasDocs: Boolean(client.doc_crmv_url || client.doc_photo_id_url),
        docs: (client.doc_crmv_url || client.doc_photo_id_url) ? [
          {
            id: 'doc_crmv',
            title: 'CRMV - Cédula Profissional do Médico Veterinário',
            category: 'Registro Profissional',
            fileName: `crmv_${cleanDoc}.jpg`,
            bucket: bucketName,
            path: `${clientStoragePath}/crmv/`,
            url: client.doc_crmv_url || client.doc_photo_id_url,
            verificationBadge: 'CRMV Válido',
            notes: `Armazenado em: ${clientStoragePath}/crmv/`
          }
        ] : []
      },
      {
        id: 'endereco',
        name: 'Comprovante Endereço',
        icon: MapPin,
        badge: client.doc_address_url ? 'Anexado ✓' : 'Pendente',
        hasDocs: Boolean(client.doc_address_url),
        docs: client.doc_address_url ? [
          {
            id: 'doc_address',
            title: 'Comprovante de Endereço Residencial / Profissional',
            category: 'Endereço',
            fileName: `comprovante_endereco_${cleanDoc}.jpg`,
            bucket: bucketName,
            path: `${clientStoragePath}/comprovante_endereco/`,
            url: client.doc_address_url,
            verificationBadge: 'Comprovante Válido',
            notes: `Armazenado em: ${clientStoragePath}/comprovante_endereco/`
          }
        ] : []
      }
    ])
  ];

  const handleOpenDoc = (doc) => {
    setSelectedDocument(doc);
    setIsViewerOpen(true);
  };

  const currentFolderData = folders.find((f) => f.id === activeFolder) || folders[0];
  const getCleanPhone = (phone) => phone ? phone.replace(/\D/g, '') : '';
  const whatsAppUrl = formData.phone ? `https://wa.me/55${getCleanPhone(formData.phone)}?text=Ol%C3%A1%2C%20falamos%20da%20Vetline%20Distribuidora%20sobre%20o%20seu%20cadastro.` : null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-fade-in">
        <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
          
          {/* 1. Cabeçalho Compacto e Elegante */}
          <div className="bg-slate-900 text-white px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between gap-3 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-green/20 text-brand-green border border-brand-green/30 flex items-center justify-center flex-shrink-0">
                {isPJ ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.2 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    isPJ ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40' : 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                  }`}>
                    {isPJ ? 'PJ' : 'PF'}
                  </span>
                  
                  <span className="text-xs text-slate-300 font-mono font-bold">
                    {formData.document_number}
                  </span>

                  {/* Badge de Status Atual */}
                  <span className={`px-2 py-0.2 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                    formData.status === 'aprovado'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : formData.status === 'recusado'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : formData.status === 'em_analise'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                    {formData.status === 'aprovado' ? 'Aprovado' :
                     formData.status === 'recusado' ? 'Recusado' :
                     formData.status === 'em_analise' ? 'Em Análise' : 'Pendente'}
                  </span>
                </div>

                <div className="flex items-center gap-2 truncate mt-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-white truncate">
                    {formData.full_name}
                  </h2>
                  {formData.trade_name && (
                    <span className="text-xs text-brand-green-light font-medium truncate hidden md:inline">
                      ({formData.trade_name})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Ações Rápidas de Edição, Contato e Fechar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                  isEditing 
                    ? 'bg-brand-green text-white ring-2 ring-brand-green/40' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
                }`}
                title={isEditing ? 'Sair do Modo de Edição' : 'Habilitar Edição dos Campos'}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Editando' : 'Editar'}</span>
              </button>

              {whatsAppUrl && (
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow-xs transition-colors"
                  title="Abrir WhatsApp"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Barra de Abas Compacta */}
          <div className="bg-slate-100 px-3 sm:px-6 pt-2 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
            {folders.map((folder) => {
              const Icon = folder.icon;
              const isActive = activeFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer border-t border-x ${
                    isActive
                      ? 'bg-white text-slate-900 border-slate-200 border-b-transparent shadow-xs relative -mb-px z-10'
                      : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200 border-transparent hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-green' : 'text-slate-400'}`} />
                  <span>{folder.name}</span>
                  {folder.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      folder.badge.includes('✓') || folder.id === 'ficha'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {folder.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 3. Conteúdo Central (Scroll Suave e Espaçamento Otimizado) */}
          <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-slate-50/50">
            
            {/* SE FOR A FICHA CADASTRAL & DADOS COMERCIAIS */}
            {activeFolder === 'ficha' ? (
              <div className="space-y-3.5">
                
                {/* Banner de Edição */}
                {isEditing && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-900">
                    <div className="flex items-center gap-2 font-medium">
                      <Edit3 className="w-4 h-4 text-amber-600 animate-pulse flex-shrink-0" />
                      <span>Modo de edição ativo: altere os campos abaixo e clique em Salvar.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveAll()}
                      disabled={isSaving}
                      className="px-2.5 py-1 bg-brand-green hover:bg-brand-dark text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      <span>Salvar</span>
                    </button>
                  </div>
                )}

                {/* GRID 2 COLUNAS: DADOS CADASTRAIS (ESQ) & DADOS COMERCIAIS / ERP (DIR) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                  
                  {/* COLUNA ESQUERDA (7 colunas): Identificação, Contato e Endereço */}
                  <div className="lg:col-span-7 space-y-3.5">
                    
                    {/* Bloco de Dados Pessoais / Empresa */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-2.5">
                      <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                        <User className="w-3.5 h-3.5 text-brand-green" />
                        <span>Dados do Cliente & Contato</span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-slate-500 font-semibold block mb-0.5">Nome / Razão Social:</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.full_name}
                              onChange={(e) => handleChange('full_name', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-brand-green outline-none font-bold text-slate-800"
                            />
                          ) : (
                            <div className="font-bold text-slate-900 text-sm">{formData.full_name}</div>
                          )}
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 font-semibold block mb-0.5">Documento ({isPJ ? 'CNPJ' : 'CPF'}):</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.document_number}
                              onChange={(e) => handleChange('document_number', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-brand-green outline-none font-mono font-bold text-slate-800"
                            />
                          ) : (
                            <div className="font-mono font-bold text-slate-800">{formData.document_number}</div>
                          )}
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 font-semibold block mb-0.5">Segmento de Atuação:</label>
                          {isEditing ? (
                            <select
                              value={formData.segment}
                              onChange={(e) => handleChange('segment', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-brand-green outline-none text-slate-800 bg-white"
                            >
                              <option value="">Selecione...</option>
                              {AVAILABLE_SEGMENTS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="font-semibold text-slate-800">{formData.segment}</div>
                          )}
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 font-semibold block mb-0.5">Telefone / WhatsApp:</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.phone}
                              onChange={(e) => handleChange('phone', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-brand-green outline-none font-bold text-slate-800"
                            />
                          ) : (
                            <a href={`tel:${getCleanPhone(formData.phone)}`} className="text-brand-teal hover:underline font-bold">
                              {formData.phone}
                            </a>
                          )}
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 font-semibold block mb-0.5">E-mail:</label>
                          {isEditing ? (
                            <input
                              type="email"
                              value={formData.email}
                              onChange={(e) => handleChange('email', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-brand-green outline-none text-slate-800"
                            />
                          ) : (
                            <a href={`mailto:${formData.email}`} className="text-brand-teal hover:underline font-medium truncate block">
                              {formData.email}
                            </a>
                          )}
                        </div>

                        {isPJ && (
                          <div className="sm:col-span-2">
                            <label className="text-[11px] text-slate-500 font-semibold block mb-0.5">Inscrição Estadual (IE):</label>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.ie_number}
                                onChange={(e) => {
                                  handleChange('ie_number', e.target.value);
                                  handleChange('has_ie', Boolean(e.target.value.trim()));
                                }}
                                placeholder="Número da IE ou Isento"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-brand-green outline-none text-slate-800"
                              />
                            ) : (
                              <div className="font-medium text-slate-800">
                                {formData.has_ie ? (formData.ie_number || 'Informada em Anexo') : 'Isento / Não possui'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bloco de Endereço Principal / Cadastral */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                          <MapPin className="w-3.5 h-3.5 text-brand-green" />
                          <span>Endereço Principal / Cadastral</span>
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">CEP</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.zipcode}
                              onChange={(e) => handleChange('zipcode', e.target.value)}
                              placeholder="00000-000"
                              className="w-full px-2 py-1 rounded border border-slate-300 font-mono text-xs"
                            />
                          ) : (
                            <strong className="font-mono text-slate-800">{formData.zipcode || '-'}</strong>
                          )}
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-400 block font-medium">Logradouro / Nº</span>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={formData.street}
                                onChange={(e) => handleChange('street', e.target.value)}
                                placeholder="Rua"
                                className="flex-1 px-2 py-1 rounded border border-slate-300 text-xs"
                              />
                              <input
                                type="text"
                                value={formData.number}
                                onChange={(e) => handleChange('number', e.target.value)}
                                placeholder="Nº"
                                className="w-14 px-2 py-1 rounded border border-slate-300 text-xs"
                              />
                            </div>
                          ) : (
                            <strong className="text-slate-800 truncate block">
                              {formData.street || '-'}, {formData.number || 'S/N'}
                            </strong>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Bairro</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.neighborhood}
                              onChange={(e) => handleChange('neighborhood', e.target.value)}
                              placeholder="Bairro"
                              className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                            />
                          ) : (
                            <strong className="text-slate-800">{formData.neighborhood || '-'}</strong>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Cidade/UF</span>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => handleChange('city', e.target.value)}
                                placeholder="Cidade"
                                className="flex-1 px-2 py-1 rounded border border-slate-300 text-xs"
                              />
                              <input
                                type="text"
                                value={formData.state}
                                onChange={(e) => handleChange('state', e.target.value)}
                                maxLength={2}
                                placeholder="UF"
                                className="w-10 px-1 py-1 rounded border border-slate-300 text-xs uppercase"
                              />
                            </div>
                          ) : (
                            <strong className="text-slate-800">{formData.city || '-'} - {formData.state || '-'}</strong>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Complemento</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.complement}
                              onChange={(e) => handleChange('complement', e.target.value)}
                              placeholder="Complemento"
                              className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                            />
                          ) : (
                            <span className="text-slate-700">{formData.complement || 'Nenhum'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bloco de Endereço de Entrega */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                          <Truck className="w-3.5 h-3.5 text-brand-teal" />
                          <span>Endereço de Entrega</span>
                        </h3>
                        {isEditing && (
                          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.has_different_delivery_address}
                              onChange={(e) => handleChange('has_different_delivery_address', e.target.checked)}
                              className="rounded text-brand-green"
                            />
                            <span>Endereço diferente</span>
                          </label>
                        )}
                      </div>

                      {formData.has_different_delivery_address || isEditing ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">CEP</span>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.delivery_zipcode}
                                onChange={(e) => handleChange('delivery_zipcode', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-300 font-mono text-xs"
                              />
                            ) : (
                              <strong className="font-mono text-slate-800">{formData.delivery_zipcode || '-'}</strong>
                            )}
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] text-slate-400 block font-medium">Logradouro / Nº</span>
                            {isEditing ? (
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={formData.delivery_street}
                                  onChange={(e) => handleChange('delivery_street', e.target.value)}
                                  placeholder="Rua"
                                  className="flex-1 px-2 py-1 rounded border border-slate-300 text-xs"
                                />
                                <input
                                  type="text"
                                  value={formData.delivery_number}
                                  onChange={(e) => handleChange('delivery_number', e.target.value)}
                                  placeholder="Nº"
                                  className="w-14 px-2 py-1 rounded border border-slate-300 text-xs"
                                />
                              </div>
                            ) : (
                              <strong className="text-slate-800 truncate block">
                                {formData.delivery_street || ''}, {formData.delivery_number || 'S/N'}
                              </strong>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">Bairro</span>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.delivery_neighborhood}
                                onChange={(e) => handleChange('delivery_neighborhood', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                              />
                            ) : (
                              <strong className="text-slate-800">{formData.delivery_neighborhood || '-'}</strong>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">Cidade/UF</span>
                            {isEditing ? (
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={formData.delivery_city}
                                  onChange={(e) => handleChange('delivery_city', e.target.value)}
                                  className="flex-1 px-2 py-1 rounded border border-slate-300 text-xs"
                                />
                                <input
                                  type="text"
                                  value={formData.delivery_state}
                                  onChange={(e) => handleChange('delivery_state', e.target.value)}
                                  maxLength={2}
                                  className="w-10 px-1 py-1 rounded border border-slate-300 text-xs uppercase"
                                />
                              </div>
                            ) : (
                              <strong className="text-slate-800">{formData.delivery_city || '-'} - {formData.delivery_state || '-'}</strong>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">Complemento</span>
                            {isEditing ? (
                              <input
                                type="text"
                                value={formData.delivery_complement}
                                onChange={(e) => handleChange('delivery_complement', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                              />
                            ) : (
                              <span className="text-slate-700">{formData.delivery_complement || 'Nenhum'}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span>Entregar no mesmo endereço principal / cadastral.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COLUNA DIREITA (5 colunas): Dados Comerciais & ERP em Destaque */}
                  <div className="lg:col-span-5 space-y-3.5">
                    
                    {/* Card Comercial ERP */}
                    <div className="bg-white rounded-xl border-2 border-brand-green/30 p-3.5 shadow-xs space-y-3 bg-gradient-to-br from-white to-brand-green-light/10">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                          <Receipt className="w-3.5 h-3.5 text-brand-green" />
                          <span>Dados Comerciais (ERP)</span>
                        </h3>
                        <span className="text-[10px] font-bold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">
                          Configurações
                        </span>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        
                        {/* Tabela de Preço */}
                        <div>
                          <label className="text-[11px] text-slate-600 font-bold block mb-1">
                            Tabela de Preço (tab_pre):
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.tab_pre}
                              onChange={(e) => handleChange('tab_pre', e.target.value.toUpperCase())}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-brand-green font-mono font-bold text-slate-900 bg-white"
                              placeholder="Ex: VTL01"
                            />
                          ) : (
                            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900 text-sm">{formData.tab_pre || 'VTL01'}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Padrão ERP</span>
                            </div>
                          )}
                        </div>

                        {/* Tipo de Pedido */}
                        <div>
                          <label className="text-[11px] text-slate-600 font-bold block mb-1">
                            Tipo de Pedido (tp_ped):
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={formData.tp_ped}
                              onChange={(e) => handleChange('tp_ped', e.target.value.toUpperCase())}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-brand-green font-mono font-bold text-slate-900 bg-white"
                              placeholder="Ex: VTL01"
                            />
                          ) : (
                            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900 text-sm">{formData.tp_ped || 'VTL01'}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Padrão ERP</span>
                            </div>
                          )}
                        </div>

                        {/* Vendedor Responsável */}
                        <div>
                          <label className="text-[11px] text-slate-600 font-bold block mb-1">
                            Vendedor Responsável (cd_vend):
                          </label>
                          {isEditing ? (
                            <select
                              value={formData.cd_vend}
                              onChange={(e) => handleChange('cd_vend', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-300 focus:border-brand-green font-mono text-xs text-slate-900 bg-white"
                            >
                              <option value="ATENA">ATENA (Sem Vendedor)</option>
                              {salespeopleList.map((vend) => (
                                <option key={vend.cd_vend} value={vend.cd_vend}>
                                  [{vend.cd_vend}] {vend.nome_vendedor}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {formData.cd_vend || 'ATENA'}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                formData.cd_vend === 'ATENA' || !formData.cd_vend
                                  ? 'bg-slate-200 text-slate-600'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {formData.cd_vend === 'ATENA' || !formData.cd_vend ? 'Sem Vendedor' : 'Atribuído'}
                              </span>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* Card de Auditoria & Bureau Automático (Infosimples) */}
                    {isPJ && (
                      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-3.5 shadow-md space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <h4 className="font-bold text-xs text-white">Bureau & Conformidade (Infosimples)</h4>
                          </div>
                          {client.bureau_consulted_at && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              {new Date(client.bureau_consulted_at).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>

                        {/* Status resumidos */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                            <span className="text-[10px] text-slate-400 block">JUCESP (SP)</span>
                            <span className="font-bold text-slate-200 truncate block text-[11px]">
                              {client.nire_jucesp ? `NIRE: ${client.nire_jucesp}` : (client.doc_jucesp_url ? 'Registrada ✓' : 'Disponível')}
                            </span>
                          </div>
                          <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                            <span className="text-[10px] text-slate-400 block">CENPROT (Protestos)</span>
                            <span className={`font-bold truncate block text-[11px] ${
                              client.total_protestos === 0 
                                ? 'text-emerald-400' 
                                : (client.total_protestos > 0 ? 'text-amber-400' : 'text-slate-300')
                            }`}>
                              {client.total_protestos !== null && client.total_protestos !== undefined 
                                ? (client.total_protestos === 0 ? '0 Protestos ✓' : `${client.total_protestos} Protesto(s)`)
                                : (client.doc_cenprot_url ? 'Consultado' : 'Disponível')}
                            </span>
                          </div>
                        </div>

                        {bureauFeedback && (
                          <div className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                            bureauFeedback.type === 'success' 
                              ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-300' 
                              : 'bg-red-950/80 border border-red-700/60 text-red-300'
                          }`}>
                            <span>{bureauFeedback.message}</span>
                          </div>
                        )}

                        {/* Botão de Disparo */}
                        <button
                          type="button"
                          onClick={handleRunBureauAudit}
                          disabled={isAuditingBureau}
                          className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-xs"
                        >
                          {isAuditingBureau ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Consultando JUCESP & CENPROT...</span>
                            </>
                          ) : (
                            <>
                              <Search className="w-3.5 h-3.5" />
                              <span>{client.doc_jucesp_url || client.doc_cenprot_url ? 'Reconsultar Bureau (Infosimples)' : 'Consultar JUCESP & CENPROT Agora'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Resumo de Documentos Anexados */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-2 text-xs">
                      <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                        <Folder className="w-3.5 h-3.5 text-brand-teal" />
                        <span>Documentos Anexados</span>
                      </h4>
                      <div className="space-y-1.5">
                        {folders.filter(f => f.id !== 'ficha').map(f => (
                          <div 
                            key={f.id} 
                            onClick={() => setActiveFolder(f.id)}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-brand-green-light/30 transition-colors cursor-pointer"
                          >
                            <span className="text-slate-700 font-medium truncate">{f.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                              f.hasDocs ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {f.badge}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            ) : (
              /* SE FOR UMA ABA DE DOCUMENTO ESPECÍFICO */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-brand-green" />
                    <span>{currentFolderData.name}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveFolder('ficha')}
                    className="text-xs text-brand-teal font-bold hover:underline cursor-pointer"
                  >
                    ← Voltar para Ficha Cadastral
                  </button>
                </div>

                {currentFolderData.docs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {currentFolderData.docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white rounded-xl border border-slate-200 hover:border-brand-green shadow-xs p-3.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h4 className="font-bold text-xs text-slate-900">{doc.title}</h4>
                              <span className="text-[10px] text-slate-400 font-mono">{doc.fileName}</span>
                            </div>
                            {doc.verificationBadge && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex-shrink-0">
                                {doc.verificationBadge}
                              </span>
                            )}
                          </div>

                          {/* Preview Otimizado do Documento */}
                          <div 
                            onClick={() => handleOpenDoc(doc)}
                            className="w-full h-44 bg-slate-100 rounded-lg overflow-hidden relative cursor-pointer group border border-slate-200 flex items-center justify-center my-2"
                          >
                            <img
                              src={doc.url}
                              alt={doc.title}
                              className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://placehold.co/600x400/f1f5f9/475569?text=Visualizar+Documento';
                              }}
                            />
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                              <Maximize2 className="w-4 h-4" />
                              <span>Clique para Ampliar</span>
                            </div>
                          </div>

                          <p className="text-[10px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 mb-2 truncate">
                            {doc.path}
                          </p>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleOpenDoc(doc)}
                            className="flex-1 py-1.5 px-3 rounded-lg bg-brand-green hover:bg-brand-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualizar</span>
                          </button>
                          <a
                            href={doc.url}
                            download={doc.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-200 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Baixar</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
                    <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h4 className="font-bold text-slate-700 text-xs">Nenhum documento anexado nesta pasta</h4>
                    <p className="text-[11px] text-slate-400 mt-1">O cliente não enviou arquivos para esta categoria.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Rodapé Fixo e Otimizado */}
          <div className="bg-white px-3 py-2.5 sm:px-6 sm:py-3 border-t border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 flex-shrink-0">
            
            {/* Campo de Observações Internas */}
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={formData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Observações internas..."
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:border-brand-green outline-none bg-slate-50"
              />
              <button
                type="button"
                onClick={() => handleSaveAll()}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-800 transition-colors flex-shrink-0 cursor-pointer flex items-center gap-1"
                title="Salvar alterações"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                <span>Salvar</span>
              </button>
            </div>

            {/* Ações de Status */}
            <div className="flex items-center gap-1.5 justify-end flex-wrap">
              {saveSuccess && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mr-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Salvo!
                </span>
              )}

              {/* Botão: Em Análise */}
              <button
                type="button"
                onClick={() => handleSaveAll('em_analise')}
                disabled={isSaving}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                  formData.status === 'em_analise'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Em Análise</span>
              </button>

              {/* Botão: Recusar */}
              <button
                type="button"
                onClick={() => handleSaveAll('recusado')}
                disabled={isSaving}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                  formData.status === 'recusado'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Recusar</span>
              </button>

              {/* Botão: Confirmar / Aprovar */}
              <button
                type="button"
                onClick={() => handleSaveAll('aprovado')}
                disabled={isSaving}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  formData.status === 'aprovado'
                    ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400 ring-offset-1'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Confirmar & Aprovar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizador Flutuante de Documentos */}
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        document={selectedDocument}
      />
    </>
  );
};
