import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  User,
  Info,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2,
  MapPin,
  Search,
  FileCheck,
  ShieldCheck,
  Phone,
  FileText,
  BadgeAlert,
  Briefcase,
  UserCheck,
  ChevronDown,
  X,
  Trash2,
  RotateCcw,
  HelpCircle
} from 'lucide-react';
import { DocumentUpload } from './DocumentUpload';
import { TermsModal } from './TermsModal';
import { CreatePasswordModal } from './CreatePasswordModal';
import { SegmentHelpModal } from './SegmentHelpModal';
import { PartnerMismatchModal } from './PartnerMismatchModal';
import { registerClientWithAuth } from '../lib/clientAuth';
import { executarAuditoriaBureau, consultarSintegra, consultarCRMV, validarCRMVComCPF } from '../lib/infosimples';
import { validatePartnerDocument, validateCompanyAttachment, validateCrmvAttachment } from '../utils/documentValidator';
import {
  maskCPF,
  maskCNPJ,
  maskPhone,
  maskCEP,
  unmask
} from '../utils/masks';
import {
  isValidCPF,
  isValidCNPJ,
  isValidEmail,
  fetchAddressByCEP,
  fetchCNPJDataFromBrasilAPI
} from '../utils/validators';
import {
  uploadDocument,
  submitNewClient,
  updateClientData,
  fetchSalespeople,
  fetchSegments,
  checkRateLimit,
  getClientIp,
  checkExistingApprovedClient
} from '../lib/supabase';

export const RegistrationForm = ({ onSuccess }) => {
  // Estado do formulário
  const [personType, setPersonType] = useState('PJ'); // 'PJ' ou 'PF'

  // Dados principais
  const [documentNumber, setDocumentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [crmv, setCrmv] = useState(''); // CRMV para Pessoa Física
  const [tpInscricao, setTpInscricao] = useState('E'); // 'E' (Estadual), 'I' (Isento), 'M' (Municipal)
  const [numeroInscricao, setNumeroInscricao] = useState('');
  const [phone, setPhone] = useState('');
  const [segment, setSegment] = useState(''); // Guarda o ram_ativ selecionado
  const [segmentsList, setSegmentsList] = useState([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [email, setEmail] = useState('');

  // Vendedor / Atendimento
  const [hasSalesperson, setHasSalesperson] = useState(false); // false = 'Não' (envia 'ATENA'), true = 'Sim'
  const [salespeopleList, setSalespeopleList] = useState([]);
  const [loadingSalespeople, setLoadingSalespeople] = useState(false);
  const [selectedSalespersonCode, setSelectedSalespersonCode] = useState('');
  const [salespersonSearch, setSalespersonSearch] = useState('');
  const [isSalespersonDropdownOpen, setIsSalespersonDropdownOpen] = useState(false);
  const salespersonDropdownRef = useRef(null);

  // BrasilAPI Dados do CNPJ
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjInfo, setCnpjInfo] = useState(null);
  const [cnpjAlert, setCnpjAlert] = useState('');

  // Validação de Duplicidade (Cliente já Aprovado no sistema)
  const [loadingDuplicateCheck, setLoadingDuplicateCheck] = useState(false);
  const [duplicateApprovedClient, setDuplicateApprovedClient] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // CRMV Validação (PF)
  const [loadingCrmv, setLoadingCrmv] = useState(false);
  const [crmvData, setCrmvData] = useState(null);
  const [crmvAlert, setCrmvAlert] = useState('');
  const crmvAuditPromiseRef = useRef(null);

  // Refs para pré-consulta antecipada do Bureau (JUCESP & CENPROT & SINTEGRA)
  const bureauAuditPromiseRef = useRef(null);
  const bureauAuditResultRef = useRef(null);
  const sintegraResultRef = useRef(null);

  // Endereço Principal / Cadastral (para PF e PJ)
  const [zipcode, setZipcode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [complement, setComplement] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loadingMainCep, setLoadingMainCep] = useState(false);
  const [mainCepError, setMainCepError] = useState('');

  // Endereço de entrega divergente
  const [hasDifferentDelivery, setHasDifferentDelivery] = useState(false);
  const [deliveryCep, setDeliveryCep] = useState('');
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryNumber, setDeliveryNumber] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [deliveryComplement, setDeliveryComplement] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState('');

  // Documentos anexados - PJ
  const [docContract, setDocContract] = useState(null); // Contrato Social (PJ)
  const [docPartnerPhoto, setDocPartnerPhoto] = useState(null); // Doc Foto do Sócio (PJ)

  // Documentos anexados - PF
  const [docCRMV, setDocCRMV] = useState(null); // CRMV (PF - Obrigatório)
  const [docAddress, setDocAddress] = useState(null); // Comprovante de Endereço (PF - Obrigatório)

  // Termos e status
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [partnerMismatchData, setPartnerMismatchData] = useState(null);
  const [showPartnerMismatchModal, setShowPartnerMismatchModal] = useState(false);
  const [isValidatingPartnerDoc, setIsValidatingPartnerDoc] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [errors, setErrors] = useState({});

  // Função auxiliar para busca insensível a acentos e maiúsculas
  const normalizeText = (text) => {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  // Limpa todos os campos do formulário para reinício
  const resetForm = () => {
    setDocumentNumber('');
    setFullName('');
    setCrmv('');
    setCrmvData(null);
    setCrmvAlert('');
    crmvAuditPromiseRef.current = null;
    setTpInscricao(personType === 'PJ' ? 'E' : 'I');
    setNumeroInscricao(personType === 'PJ' ? '' : 'ISENTO');
    setPhone('');
    setSegment('');
    setEmail('');
    setHasSalesperson(false);
    setSelectedSalespersonCode('');
    setSalespersonSearch('');
    setCnpjInfo(null);
    setCnpjAlert('');
    setDuplicateApprovedClient(null);
    setLoadingDuplicateCheck(false);
    bureauAuditPromiseRef.current = null;
    bureauAuditResultRef.current = null;
    sintegraResultRef.current = null;
    setZipcode('');
    setStreet('');
    setNumber('');
    setNeighborhood('');
    setComplement('');
    setCity('');
    setState('');
    setMainCepError('');
    setHasDifferentDelivery(false);
    setDeliveryCep('');
    setDeliveryStreet('');
    setDeliveryNumber('');
    setDeliveryNeighborhood('');
    setDeliveryComplement('');
    setDeliveryCity('');
    setDeliveryState('');
    setCepError('');
    setDocContract(null);
    setDocPartnerPhoto(null);
    setDocCRMV(null);
    setDocAddress(null);
    setAgreedTerms(false);
    setErrors({});
    setSubmitError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Carrega lista de vendedores da tabela public.vendedor
  const loadSalespeopleData = async (force = false) => {
    setLoadingSalespeople(true);
    try {
      const res = await fetchSalespeople(force);
      if (res.success && res.data && res.data.length > 0) {
        setSalespeopleList(res.data);
      }
    } catch (e) {
    } finally {
      setLoadingSalespeople(false);
    }
  };

  useEffect(() => {
    loadSalespeopleData();

    // Carrega segmentos da tabela novo_cliente.segmento
    const loadSegmentsData = async () => {
      setLoadingSegments(true);
      try {
        const res = await fetchSegments();
        if (res.success && res.data && res.data.length > 0) {
          setSegmentsList(res.data);
        }
      } catch (err) {
        console.warn('Erro ao carregar lista de segmentos:', err);
      } finally {
        setLoadingSegments(false);
      }
    };
    loadSegmentsData();
  }, []);

  // Fechar dropdown de vendedor ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (salespersonDropdownRef.current && !salespersonDropdownRef.current.contains(e.target)) {
        setIsSalespersonDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtro de vendedores por código (cd_vend) e por nome (nome_vendedor), ocultando 'ATENA'
  const filteredSalespeople = salespeopleList.filter((v) => {
    if (!v.cd_vend || !v.nome_vendedor) return false;
    if (v.cd_vend.toUpperCase() === 'ATENA' || v.nome_vendedor.toUpperCase().includes('ATENA')) return false;
    if (!salespersonSearch.trim()) return true;
    const term = normalizeText(salespersonSearch);
    const matchCd = normalizeText(v.cd_vend).includes(term);
    const matchNome = normalizeText(v.nome_vendedor).includes(term);
    const matchEquipe = v.nome_equipe ? normalizeText(v.nome_equipe).includes(term) : false;
    return matchCd || matchNome || matchEquipe;
  });

  const selectedSalespersonObj = salespeopleList.find((v) => v.cd_vend === selectedSalespersonCode);

  // Seleciona segmento vindo do modal de ajuda mapeando para o ram_ativ
  const handleSelectSegmentFromModal = (selectedValue) => {
    if (!selectedValue) return;
    const found = segmentsList.find(
      s => String(s.ram_ativ) === String(selectedValue) ||
        s.descricao.toUpperCase() === String(selectedValue).toUpperCase()
    );
    if (found) {
      setSegment(found.ram_ativ);
    } else {
      setSegment(selectedValue);
    }
    if (errors.segment) setErrors(prev => ({ ...prev, segment: null }));
  };

  // Reset de documento ao trocar tipo de pessoa
  const handlePersonTypeChange = (type) => {
    setPersonType(type);
    setDocumentNumber('');
    setFullName('');
    setCrmv('');
    setCrmvData(null);
    setCrmvAlert('');
    crmvAuditPromiseRef.current = null;
    setTpInscricao(type === 'PJ' ? 'E' : 'I');
    setNumeroInscricao(type === 'PJ' ? '' : 'ISENTO');
    setCnpjInfo(null);
    setCnpjAlert('');
    setDuplicateApprovedClient(null);
    setLoadingDuplicateCheck(false);
    setErrors({});

    // Limpa documentos conforme o tipo
    if (type === 'PF') {
      setDocContract(null);
      setDocPartnerPhoto(null);
    } else {
      setDocCRMV(null);
      setDocAddress(null);
    }
  };

  // Validação em tempo real do CRMV no CFMV via Infosimples e cruzamento obrigatório com CPF
  const handleCrmvBlur = async (crmvValOverride = null) => {
    const valToQuery = typeof crmvValOverride === 'string' ? crmvValOverride : crmv;
    if (!valToQuery || !valToQuery.trim()) {
      setCrmvData(null);
      setCrmvAlert('');
      return null;
    }

    setLoadingCrmv(true);
    setCrmvAlert('');
    try {
      const ufSearch = state || 'SP';
      const cleanCpf = personType === 'PF' ? unmask(documentNumber) : '';
      const res = await validarCRMVComCPF(valToQuery, cleanCpf, ufSearch, fullName);
      if (res && res.success && res.isValid && res.isAtivo && !res.isMismatch) {
        setCrmvData(res);
        setCrmvAlert('');
        // Sugere o nome do profissional se o campo de Nome Completo estiver vazio
        if (res.nome && !fullName.trim()) {
          setFullName(res.nome);
          if (errors.fullName) setErrors(prev => ({ ...prev, fullName: null }));
        }
        if (res.uf && !state) {
          setState(res.uf);
        }
        return res;
      } else {
        const fallbackObj = {
          success: res?.success || false,
          isValid: false,
          isAtivo: res?.isAtivo || false,
          isMismatch: res?.isMismatch || false,
          situacao: res?.situacao || 'Inválido / Divergente',
          nome: res?.nome || '',
          crmv: res?.crmv || valToQuery,
          error: res?.error || 'Não foi possível confirmar a regularidade do CRMV no CFMV ou houve divergência com o CPF informado.'
        };
        setCrmvData(fallbackObj);
        setCrmvAlert(fallbackObj.error);
        return fallbackObj;
      }
    } catch (err) {
      console.warn('Erro ao consultar CRMV:', err);
      const errObj = {
        success: false,
        isValid: false,
        isAtivo: false,
        isMismatch: false,
        situacao: 'Erro de Comunicação',
        error: 'Não foi possível consultar o CRMV no momento. Tente novamente.'
      };
      setCrmvData(errObj);
      setCrmvAlert(errObj.error);
      return errObj;
    } finally {
      setLoadingCrmv(false);
    }
  };

  // Função central de consulta e validação de situação cadastral do CNPJ na Receita Federal
  const executeCnpjQuery = async (cleanCnpj) => {
    if (!cleanCnpj || cleanCnpj.length !== 14 || !isValidCNPJ(cleanCnpj)) return;

    // 1. Checagem prévia se o CNPJ já está APROVADO no sistema
    setLoadingDuplicateCheck(true);
    const dupCheck = await checkExistingApprovedClient(cleanCnpj);
    setLoadingDuplicateCheck(false);

    if (dupCheck.exists) {
      setDuplicateApprovedClient(dupCheck.client || { status: 'aprovado' });
      setShowDuplicateModal(true);
      setCnpjInfo(null);
      if (dupCheck.client?.razao_social_nome) {
        setFullName(dupCheck.client.razao_social_nome);
      }
      setCnpjAlert('Este CNPJ já possui cadastro APROVADO e integrado no sistema. Não é permitido novo envio.');
      setErrors((prev) => ({
        ...prev,
        documentNumber: 'Este CNPJ já possui cadastro APROVADO e integrado no sistema.'
      }));
      return;
    }
    setDuplicateApprovedClient(null);

    setLoadingCnpj(true);
    setCnpjAlert('');
    try {
      const data = await fetchCNPJDataFromBrasilAPI(cleanCnpj);
      if (data) {
        setCnpjInfo(data);
        if (data.isAtiva) {
          setCnpjAlert('');
          if (data.razaoSocial) {
            setFullName(data.razaoSocial);
            if (errors.fullName) setErrors(prev => ({ ...prev, fullName: null }));
          }
          if (data.suggestedSegment && !segment) {
            const matched = segmentsList.find(s =>
              s.descricao.toLowerCase().includes(data.suggestedSegment.toLowerCase()) ||
              data.suggestedSegment.toLowerCase().includes(s.descricao.toLowerCase())
            );
            if (matched) {
              setSegment(matched.ram_ativ);
            } else {
              setSegment(data.suggestedSegment);
            }
            if (errors.segment) setErrors(prev => ({ ...prev, segment: null }));
          }

          // Dispara antecipadamente a consulta na JUCESP e CENPROT em segundo plano
          bureauAuditResultRef.current = null;
          bureauAuditPromiseRef.current = executarAuditoriaBureau({
            cpf_cnpj: cleanCnpj,
            razao_social_nome: data?.razaoSocial || fullName,
            uf: state || 'SP'
          }).then(res => {
            bureauAuditResultRef.current = res;
            const ieFound = res?.inscricaoEstadual || res?.data?.sintegra?.ie;
            if (ieFound && ieFound !== 'ISENTO' && ieFound !== 'ISENTA' && ieFound !== '-') {
              setTpInscricao('E');
              setNumeroInscricao(ieFound);
            }
            return res;
          }).catch(err => {
            console.warn('Pré-consulta Bureau CNPJ:', err);
            return null;
          });
        } else {
          // CNPJ Inapto, Baixado, Suspenso ou Inativo
          setCnpjAlert(`Atenção: Este CNPJ consta como ${data.situacaoCadastral || 'Inapta'} na Receita Federal.`);
          if (data.razaoSocial) {
            setFullName(data.razaoSocial);
          }
        }
      } else {
        setCnpjInfo({ isAtiva: false, situacaoCadastral: 'NÃO LOCALIZADO' });
        setCnpjAlert('CNPJ não localizado na Receita Federal. Verifique os dígitos informados.');
      }
    } catch (err) {
      console.warn('Erro ao consultar dados do CNPJ:', err);
      setCnpjInfo({ isAtiva: false, situacaoCadastral: 'ERRO NA CONSULTA' });
      setCnpjAlert('Não foi possível verificar a situação cadastral do CNPJ na Receita Federal.');
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleCnpjBlur = async () => {
    if (personType !== 'PJ') return;
    const clean = unmask(documentNumber);
    if (clean.length === 14 && isValidCNPJ(clean)) {
      if (!loadingCnpj && !loadingDuplicateCheck) {
        await executeCnpjQuery(clean);
      }
    }
  };

  // Formatação automática do documento e busca na BrasilAPI para CNPJ
  const handleDocumentChange = async (e) => {
    const val = e.target.value;
    const formatted = personType === 'PJ' ? maskCNPJ(val) : maskCPF(val);
    setDocumentNumber(formatted);
    setCnpjAlert('');
    setDuplicateApprovedClient(null);
    if (errors.documentNumber) {
      setErrors((prev) => ({ ...prev, documentNumber: null }));
    }

    const clean = unmask(formatted);
    if (personType === 'PJ') {
      if (clean.length < 14) {
        setCnpjInfo(null);
        setFullName('');
      } else if (clean.length === 14 && isValidCNPJ(clean)) {
        await executeCnpjQuery(clean);
      }
    } else if (personType === 'PF') {
      if (clean.length < 11) {
        setDuplicateApprovedClient(null);
        if (crmvData) {
          setCrmvData(null);
          setCrmvAlert('');
        }
      } else if (clean.length === 11 && isValidCPF(clean)) {
        setLoadingDuplicateCheck(true);
        const dupCheck = await checkExistingApprovedClient(clean);
        setLoadingDuplicateCheck(false);

        if (dupCheck.exists) {
          setDuplicateApprovedClient(dupCheck.client || { status: 'aprovado' });
          setShowDuplicateModal(true);
          if (dupCheck.client?.razao_social_nome) {
            setFullName(dupCheck.client.razao_social_nome);
          }
          setErrors((prev) => ({
            ...prev,
            documentNumber: 'Este CPF já possui cadastro APROVADO e integrado no sistema.'
          }));
          return;
        }

        setDuplicateApprovedClient(null);

        // Se o CRMV já estiver preenchido, revalida o cruzamento entre o novo CPF e o CRMV
        if (crmv && crmv.trim()) {
          handleCrmvBlur(crmv);
        }

        // Dispara antecipadamente a consulta de Protestos (CENPROT / Direct Data) para CPF em segundo plano
        bureauAuditResultRef.current = null;
        bureauAuditPromiseRef.current = executarAuditoriaBureau({
          cpf_cnpj: clean,
          razao_social_nome: fullName,
          uf: state || 'SP'
        }).then(res => {
          bureauAuditResultRef.current = res;
          return res;
        }).catch(err => {
          console.warn('Pré-consulta Protestos CPF:', err);
          return null;
        });
      }
    }
  };

  // Busca automática do CEP do Endereço Principal (PF e PJ)
  const handleMainCepChange = async (e) => {
    const val = maskCEP(e.target.value);
    setZipcode(val);
    setMainCepError('');
    if (errors.zipcode) {
      setErrors((prev) => ({ ...prev, zipcode: null }));
    }

    const clean = unmask(val);
    if (clean.length === 8) {
      setLoadingMainCep(true);
      const data = await fetchAddressByCEP(clean);
      setLoadingMainCep(false);
      if (data) {
        setStreet(data.street || '');
        setNeighborhood(data.neighborhood || '');
        setCity(data.city || '');
        setState(data.state || '');
        setErrors((prev) => ({
          ...prev,
          street: null,
          neighborhood: null,
          city: null,
          state: null,
        }));
      } else {
        setMainCepError('CEP não encontrado.');
      }
    }
  };

  // Busca automática do CEP de entrega divergente
  const handleDeliveryCepChange = async (e) => {
    const val = maskCEP(e.target.value);
    setDeliveryCep(val);
    setCepError('');
    if (errors.deliveryCep) {
      setErrors((prev) => ({ ...prev, deliveryCep: null }));
    }

    const clean = unmask(val);
    if (clean.length === 8) {
      setLoadingCep(true);
      const data = await fetchAddressByCEP(clean);
      setLoadingCep(false);
      if (data) {
        setDeliveryStreet(data.street || '');
        setDeliveryNeighborhood(data.neighborhood || '');
        setDeliveryCity(data.city || '');
        setDeliveryState(data.state || '');
        setErrors((prev) => ({
          ...prev,
          deliveryStreet: null,
          deliveryNeighborhood: null,
          deliveryCity: null,
          deliveryState: null,
        }));
      } else {
        setCepError('CEP de entrega não encontrado.');
      }
    }
  };

  const handleCepChange = handleDeliveryCepChange;

  // Limpar todos os campos de endereço principal
  const handleClearMainAddress = () => {
    setZipcode('');
    setStreet('');
    setNumber('');
    setComplement('');
    setNeighborhood('');
    setCity('');
    setState('');
    setMainCepError('');
    setErrors((prev) => ({
      ...prev,
      zipcode: null,
      street: null,
      number: null,
      neighborhood: null,
      city: null,
      state: null,
    }));
  };

  // Limpar todos os campos de endereço de entrega
  const handleClearDeliveryAddress = () => {
    setDeliveryCep('');
    setDeliveryStreet('');
    setDeliveryNumber('');
    setDeliveryComplement('');
    setDeliveryNeighborhood('');
    setDeliveryCity('');
    setDeliveryState('');
    setCepError('');
    setErrors((prev) => ({
      ...prev,
      deliveryCep: null,
      deliveryStreet: null,
      deliveryNumber: null,
      deliveryCity: null,
      deliveryState: null,
    }));
  };

  // Validação completa dos campos do formulário antes de abrir modal de senha
  const validateForm = () => {
    const newErrors = {};

    // 1. Tipo de Pessoa
    if (!personType) {
      newErrors.personType = 'Selecione o tipo de pessoa.';
    }

    // 2. CPF / CNPJ e Situação Cadastral
    const cleanDoc = unmask(documentNumber);
    if (duplicateApprovedClient) {
      newErrors.documentNumber = 'Este documento já possui cadastro APROVADO e integrado no sistema. Não é permitido novo envio.';
    } else if (personType === 'PJ') {
      if (!cleanDoc || cleanDoc.length !== 14 || !isValidCNPJ(cleanDoc)) {
        newErrors.documentNumber = 'Informe um CNPJ válido com 14 dígitos.';
      } else if (!cnpjInfo || !cnpjInfo.isAtiva) {
        const sit = cnpjInfo?.situacaoCadastral || 'Inativa / Não Confirmada';
        newErrors.documentNumber = `CNPJ não permitido: Situação cadastral na Receita Federal consta como "${sit}". O cadastro exige empresa com situação ATIVA.`;
      }
    } else {
      if (!cleanDoc || cleanDoc.length !== 11 || !isValidCPF(cleanDoc)) {
        newErrors.documentNumber = 'Informe um CPF válido com 11 dígitos.';
      } else if (!crmvData || !crmvData.isValid || !crmvData.isAtivo || crmvData.isMismatch) {
        newErrors.crmv = crmvData?.error || 'O cadastro de Pessoa Física exige validação de CRMV ativo, regular no CFMV e correspondente ao CPF do titular.';
      }
    }

    // 3. Razão Social / Nome Completo
    if (!fullName.trim()) {
      newErrors.fullName = personType === 'PJ' ? 'Informe a Razão Social da Empresa.' : 'Informe o Nome Completo.';
    }

    // 3.1 Inscrição para PJ / CRMV para PF
    if (personType === 'PJ') {
      if (!tpInscricao) {
        newErrors.tpInscricao = 'Selecione o tipo de inscrição.';
      } else if (tpInscricao !== 'I') {
        if (!numeroInscricao || !numeroInscricao.trim() || numeroInscricao.trim().toUpperCase() === 'ISENTO') {
          newErrors.numeroInscricao = 'Informe o número da inscrição.';
        }
      }
    } else {
      // PF
      if (!crmv.trim()) {
        newErrors.crmv = 'Informe o CRMV (Número do Registro Profissional).';
      }
    }

    // 4. Telefone / Celular
    const cleanPhone = unmask(phone);
    if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 11) {
      newErrors.phone = 'Informe um telefone/celular válido com DDD.';
    }

    // 5. Segmento
    if (!segment.trim()) {
      newErrors.segment = 'Selecione o segmento da sua empresa / atuação.';
    }

    // 6. E-mail
    if (!email.trim()) {
      newErrors.email = 'Informe o e-mail de faturamento / contato.';
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Informe um e-mail válido.';
    }

    // 7. Vendedor / Atendimento
    if (hasSalesperson && !selectedSalespersonCode) {
      newErrors.selectedSalesperson = 'Selecione o vendedor que realizou o atendimento.';
    }

    // 8. Endereço Principal / Cadastral (Obrigatório para PF e PJ)
    if (!unmask(zipcode) || unmask(zipcode).length !== 8) {
      newErrors.zipcode = 'Informe um CEP válido.';
    }
    if (!street.trim()) {
      newErrors.street = 'Informe a rua / logradouro.';
    }
    if (!number.trim()) {
      newErrors.number = 'Informe o número.';
    }
    if (!neighborhood.trim()) {
      newErrors.neighborhood = 'Informe o bairro.';
    }
    if (!city.trim()) {
      newErrors.city = 'Informe a cidade.';
    }
    if (!state) {
      newErrors.state = 'Selecione a UF.';
    }

    // 9. Endereço de entrega divergente (Opcional)
    if (hasDifferentDelivery) {
      if (!unmask(deliveryCep) || unmask(deliveryCep).length !== 8) {
        newErrors.deliveryCep = 'Informe o CEP de entrega.';
      }
      if (!deliveryStreet.trim()) {
        newErrors.deliveryStreet = 'Informe a rua / logradouro de entrega.';
      }
      if (!deliveryNumber.trim()) {
        newErrors.deliveryNumber = 'Informe o número de entrega.';
      }
      if (!deliveryCity.trim()) {
        newErrors.deliveryCity = 'Informe a cidade de entrega.';
      }
      if (!deliveryState) {
        newErrors.deliveryState = 'Selecione o estado de entrega.';
      }
    }

    // 10. Validação de Documentos conforme Regra de Negócio:
    if (personType === 'PJ') {
      // PJ: Contrato Social e Documento com Foto de um dos Sócios -> OBRIGATÓRIO PELO MENOS 1
      if (!docContract && !docPartnerPhoto) {
        newErrors.docPJGroup = 'Para Pessoa Jurídica, é obrigatório anexar pelo menos um documento: Contrato Social OU Documento com Foto de um dos Sócios.';
        newErrors.docContract = 'Anexe o Contrato Social ou o Documento com Foto do Sócio.';
        newErrors.docPartnerPhoto = 'Anexe o Documento com Foto do Sócio ou o Contrato Social.';
      }
    } else {
      // PF: Comprovante de Endereço e CRMV -> OS 2 SÃO OBRIGATÓRIOS
      if (!docCRMV) {
        newErrors.docCRMV = 'O anexo do CRMV é obrigatório para Pessoa Física.';
      }
      if (!docAddress) {
        newErrors.docAddress = 'O anexo do Comprovante de Endereço é obrigatório.';
      }
    }

    // 11. Termos
    if (!agreedTerms) {
      newErrors.agreedTerms = 'Você deve aceitar os termos de entrega para prosseguir.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validação e abertura da modal de criação de senha
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    // Bloqueio explícito e imediato se CNPJ (PJ) ou CRMV (PF) não estiverem com situação ATIVA
    if (personType === 'PJ' && (!cnpjInfo || !cnpjInfo.isAtiva)) {
      const sit = cnpjInfo?.situacaoCadastral || 'Inapta / Inativa';
      setSubmitError(`O cadastro não pode ser concluído. O CNPJ informado consta como "${sit}" na Receita Federal. Apenas empresas com situação ATIVA podem se credenciar.`);
      return;
    }
    if (personType === 'PF' && (!crmvData || !crmvData.isAtivo)) {
      setSubmitError('O cadastro não pode ser concluído. É obrigatório informar e validar um CRMV com situação Ativa e Regular no CFMV.');
      return;
    }

    if (!validateForm()) {
      // Rola suavemente até o primeiro erro se houver
      const firstErrorEl = document.querySelector('.border-red-400, .text-red-600, .bg-red-50');
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Validação antecipada de documentos (Contrato Social / Sócio contra QSA)
    if (personType === 'PJ') {
      setIsValidatingPartnerDoc(true);
      try {
        const cleanCnpj = unmask(documentNumber);
        const ufState = state || cnpjInfo?.uf || 'SP';

        let partners = cnpjInfo?.socios || [];
        if (partners.length === 0 && bureauAuditResultRef.current?.data?.socios) {
          partners = bureauAuditResultRef.current.data.socios;
        }
        if (partners.length === 0 && bureauAuditPromiseRef.current) {
          const bRes = await bureauAuditPromiseRef.current;
          if (bRes?.data?.socios) {
            partners = bRes.data.socios;
          }
        }
        if (partners.length === 0) {
          const freshData = await fetchCNPJDataFromBrasilAPI(cleanCnpj);
          if (freshData?.socios && freshData.socios.length > 0) {
            partners = freshData.socios;
            setCnpjInfo(freshData);
          }
        }

        // 1. Validação do Documento da Empresa (Contrato Social / Cartão CNPJ)
        if (docContract) {
          const contractCheck = await validateCompanyAttachment(docContract, {
            expectedCnpj: cleanCnpj,
            expectedName: fullName,
            partnersList: partners
          });

          if (!contractCheck.isValid) {
            setPartnerMismatchData({
              title: 'O cadastro não foi concluído',
              subtitle: 'Divergência identificada no Documento da Empresa',
              reasons: contractCheck.reasons,
              authorizedPartners: [],
              buttonText: 'Reenviar Documento da Empresa',
              hideReupload: false,
              shouldResetForm: false
            });
            setShowPartnerMismatchModal(true);
            setIsValidatingPartnerDoc(false);
            return;
          }
        }

        // 2. Validação do Documento do Sócio (RG / CNH) contra o QSA e CNPJ
        if (docPartnerPhoto) {
          const partnerCheck = await validatePartnerDocument(
            docPartnerPhoto,
            partners,
            cleanCnpj,
            fullName || cnpjInfo?.razaoSocial || ''
          );
          if (!partnerCheck.isValid) {
            setPartnerMismatchData({
              title: 'O cadastro não foi concluído',
              subtitle: 'Divergência identificada no Quadro Societário (QSA)',
              reasons: partnerCheck.reasons,
              authorizedPartners: partnerCheck.authorizedPartners,
              buttonText: 'Reenviar Documentos do Sócio',
              hideReupload: false,
              shouldResetForm: false
            });
            setShowPartnerMismatchModal(true);
            setIsValidatingPartnerDoc(false);
            return;
          }
        }

        // 3. Validação do SINTEGRA / Inscrição Estadual (SEFAZ) - COMENTADO TEMPORARIAMENTE
        /*
        let sintegraRes = bureauAuditResultRef.current?.data?.sintegra;
        if (!sintegraRes && bureauAuditPromiseRef.current) {
          const bRes = await bureauAuditPromiseRef.current;
          if (bRes?.data?.sintegra) {
            sintegraRes = bRes.data.sintegra;
          }
        }
        if (!sintegraRes) {
          sintegraRes = await consultarSintegra(cleanCnpj, ufState);
        }

        const sitClean = String(sintegraRes?.situacaoCadastral || '').trim().toLowerCase();
        const isHabilitado = Boolean(
          sintegraRes &&
          sintegraRes.success &&
          ['habilitado', 'ativo', 'ativa'].includes(sitClean)
        );

        if (!isHabilitado) {
          const sitDesc = sintegraRes?.situacaoCadastral || sintegraRes?.error || 'Não Habilitado';
          setPartnerMismatchData({
            title: 'O cadastro não foi concluído',
            subtitle: 'Divergência identificada na validação cadastral (SINTEGRA)',
            reasons: [
              `Situação Cadastral no SINTEGRA: "${sitDesc}".`,
              'O cadastro como Pessoa Jurídica (PJ) exige que a Situação Cadastral no SINTEGRA conste como "Habilitado" ou "Ativo".',
              `A situação atual ("${sitDesc}") impede a conclusão do cadastro no estado de ${sintegraRes?.uf || ufState}.`
            ],
            authorizedPartners: [],
            hideReupload: true,
            closeButtonText: 'Fechar formulário',
            shouldResetForm: true
          });
          setShowPartnerMismatchModal(true);
          setIsValidatingPartnerDoc(false);
          return;
        }

        sintegraResultRef.current = sintegraRes;
        */
      } catch (checkErr) {
        console.warn('Erro ao validar documentos antecipadamente:', checkErr);
      } finally {
        setIsValidatingPartnerDoc(false);
      }
    }

    // Validação de CRMV (Situação no CFMV, Cruzamento com CPF e Documento Anexado) para Pessoa Física
    if (personType === 'PF') {
      setIsValidatingPartnerDoc(true);
      try {
        // 1. Checagem de situação ativa no CFMV e cruzamento com CPF via Infosimples
        let crmvRes = crmvData;
        if (!crmvRes || !crmvRes.isValid || !crmvRes.isAtivo || crmvRes.isMismatch) {
          crmvRes = await handleCrmvBlur(crmv);
        }
        if (!crmvRes || !crmvRes.isValid || !crmvRes.isAtivo || crmvRes.isMismatch) {
          setPartnerMismatchData({
            title: 'O cadastro não foi concluído',
            subtitle: 'Divergência identificada no Conselho de Medicina Veterinária (CFMV)',
            reasons: [
              crmvRes?.error || 'Não foi possível confirmar a regularidade do CRMV ou houve divergência com o CPF informado.',
              'O cadastro como Pessoa Física exige registro profissional ATIVO no CRMV e correspondente ao CPF do titular.',
              `Profissional consultado: ${crmvRes?.nome || fullName || 'Não identificado'}.`
            ],
            authorizedPartners: [],
            hideReupload: true,
            closeButtonText: 'Fechar e revisar CRMV',
            shouldResetForm: false
          });
          setShowPartnerMismatchModal(true);
          setIsValidatingPartnerDoc(false);
          return;
        }

        // 2. Cruzamento do documento anexado do CRMV contra o CRMV informado no formulário
        if (docCRMV && crmv) {
          const crmvDocCheck = await validateCrmvAttachment(docCRMV, {
            expectedCrmv: crmv,
            expectedName: fullName,
            expectedCpf: documentNumber,
            expectedUf: state || 'SP'
          });

          if (!crmvDocCheck.isValid) {
            setPartnerMismatchData({
              title: 'O cadastro não foi concluído',
              subtitle: 'Divergência identificada no Anexo do CRMV',
              reasons: crmvDocCheck.reasons,
              authorizedPartners: [],
              buttonText: 'Reenviar Documento do CRMV',
              hideReupload: false,
              shouldResetForm: false
            });
            setShowPartnerMismatchModal(true);
            setIsValidatingPartnerDoc(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Erro ao validar CRMV antecipadamente:', err);
      } finally {
        setIsValidatingPartnerDoc(false);
      }
    }

    // Checagem prévia se o documento informado já possui cadastro APROVADO no sistema
    const cleanDocToSubmit = unmask(documentNumber);
    const dupCheck = await checkExistingApprovedClient(cleanDocToSubmit);
    if (dupCheck.exists) {
      setDuplicateApprovedClient(dupCheck.client || { status: 'aprovado' });
      setSubmitError('Este CNPJ/CPF já possui cadastro APROVADO e integrado no sistema. Não é permitido novo envio.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Checagem prévia de Rate Limiting por IP antes de prosseguir
    const rateCheck = await checkRateLimit(null, 3, 60);
    if (!rateCheck.allowed) {
      setSubmitError(rateCheck.message || 'Limite de cadastros excedido para este dispositivo/IP. Por segurança, aguarde alguns minutos antes de tentar novamente.');
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }

    // Abre a modal para o cliente criar sua senha de acesso apenas se tudo estiver validado
    setShowPasswordModal(true);
  };

  // Envio final do formulário com e-mail e senha informados na modal
  const handlePasswordSubmit = async (confirmedEmail, password) => {
    setIsSubmitting(true);
    setSubmitError(null);

    // Validação final de segurança para impedir duplicidade de cadastro aprovado
    const cleanDocFinal = unmask(documentNumber);
    const dupCheckFinal = await checkExistingApprovedClient(cleanDocFinal);
    if (dupCheckFinal.exists) {
      setDuplicateApprovedClient(dupCheckFinal.client || { status: 'aprovado' });
      setSubmitError('Este CNPJ/CPF já possui cadastro APROVADO e integrado no sistema. Não é permitido novo envio.');
      setShowPasswordModal(false);
      setIsSubmitting(false);
      return;
    }

    // Garante extração correta caso venha como 2 parâmetros ou como objeto
    let finalEmail = email;
    let finalPassword = password;

    if (typeof confirmedEmail === 'string' && password) {
      finalEmail = confirmedEmail.trim().toLowerCase();
      finalPassword = password;
    } else if (typeof confirmedEmail === 'string' && !password) {
      finalPassword = confirmedEmail;
    }

    try {
      // Upload dos documentos anexados para a pasta do CNPJ/CPF no bucket 'novos_clientes'
      let docContractUrl = null;
      let docPartnerPhotoUrl = null;
      let docCrmvUrl = null;
      let docAddressUrl = null;

      if (personType === 'PJ') {
        if (docContract) {
          docContractUrl = await uploadDocument(docContract, 'contrato_social', documentNumber);
        }
        if (docPartnerPhoto) {
          docPartnerPhotoUrl = await uploadDocument(docPartnerPhoto, 'documento_socios', documentNumber);
        }
      } else {
        // PF
        if (docCRMV) {
          docCrmvUrl = await uploadDocument(docCRMV, 'crmv', documentNumber);
        }
        if (docAddress) {
          docAddressUrl = await uploadDocument(docAddress, 'comprovante_endereco', documentNumber);
        }
      }

      // Obtém a consulta no Bureau / Protestos (CENPROT, Direct Data e JUCESP/SINTEGRA para PJ)
      let docJucespUrl = null;
      let docCenprotUrl = null;
      let docSintegraUrl = sintegraResultRef.current?.receiptUrl || null;
      let sintegraIe = sintegraResultRef.current?.ie || null;
      let nireJucesp = null;
      let totalProtestos = null;
      let bureauConsultedAt = null;

      if (documentNumber) {
        try {
          let bureauRes = bureauAuditResultRef.current;
          if (!bureauRes && bureauAuditPromiseRef.current) {
            bureauRes = await bureauAuditPromiseRef.current;
          }
          if (!bureauRes) {
            bureauRes = await executarAuditoriaBureau({
              cpf_cnpj: documentNumber,
              razao_social_nome: fullName,
              uf: state || 'SP'
            });
          }

          if (bureauRes) {
            if (bureauRes.docJucespUrl) docJucespUrl = bureauRes.docJucespUrl;
            if (bureauRes.docCenprotUrl) docCenprotUrl = bureauRes.docCenprotUrl;
            if (bureauRes.docSintegraUrl || bureauRes.docIeUrl) {
              docSintegraUrl = bureauRes.docSintegraUrl || bureauRes.docIeUrl;
            }
            if (bureauRes.inscricaoEstadual || bureauRes.data?.sintegra?.ie) {
              sintegraIe = bureauRes.inscricaoEstadual || bureauRes.data?.sintegra?.ie;
            }
            if (bureauRes.data?.jucesp?.nire || bureauRes.nireJucesp) {
              nireJucesp = bureauRes.data?.jucesp?.nire || bureauRes.nireJucesp;
            }
            if (bureauRes.data?.cenprot?.totalProtests !== undefined && bureauRes.data?.cenprot?.totalProtests !== null) {
              totalProtestos = bureauRes.data.cenprot.totalProtests;
            } else if (bureauRes.totalProtestos !== undefined && bureauRes.totalProtestos !== null) {
              totalProtestos = bureauRes.totalProtestos;
            }
            if (bureauRes.successfulServices && bureauRes.successfulServices.length > 0) {
              bureauConsultedAt = new Date().toISOString();
            }
          }
        } catch (bureauErr) {
          console.warn('Auditoria automática de bureau na submissão:', bureauErr);
        }
      }

      const hasIe = Boolean(sintegraIe && sintegraIe !== 'ISENTO' && sintegraIe !== 'ISENTA' && sintegraIe !== '-');

      // Cálculo do Limite de Crédito inicial conforme regra de negócios:
      // PJ sem protestos: R$ 3.000,00
      // PF sem protestos: R$ 1.500,00
      // Com protestos (>0): R$ 0,00
      const numProtestos = typeof totalProtestos === 'number' ? totalProtestos : (Number(totalProtestos) || 0);
      const hasProtestos = numProtestos > 0;
      const initialCreditLimit = !hasProtestos ? (personType === 'PJ' ? 3000.00 : 1500.00) : 0.00;

      // Dados estruturados para tabela novo_cliente.data_new_cliente em Português BR
      const payload = {
        tipo_pessoa: personType,
        person_type: personType,
        cpf_cnpj: documentNumber,
        document_number: documentNumber,
        storage_bucket: 'novos_clientes',
        razao_social_nome: fullName,
        full_name: fullName,
        nome_fantasia: personType === 'PJ' ? (cnpjInfo?.tradeName || cnpjInfo?.nomeFantasia || null) : null,
        trade_name: personType === 'PJ' ? (cnpjInfo?.tradeName || cnpjInfo?.nomeFantasia || null) : null,
        tp_inscricao: personType === 'PF' ? 'I' : tpInscricao,
        numero_inscricao: personType === 'PF' ? 'ISENTO' : (tpInscricao === 'I' ? 'ISENTO' : (numeroInscricao?.trim() || sintegraIe || 'ISENTO')),
        crmv: personType === 'PF' ? (crmv?.trim() || null) : null,
        telefone: phone,
        phone: phone,
        segmento: segment,
        segment: segment,
        email: finalEmail,
        cep: zipcode,
        zipcode: zipcode,
        logradouro: street,
        street: street,
        numero: number,
        number: number,
        bairro: neighborhood,
        neighborhood: neighborhood,
        complemento: complement || null,
        complement: complement || null,
        cidade: city,
        city: city,
        uf: state,
        state: state,
        cd_vend: hasSalesperson ? (selectedSalespersonCode || 'ATENA') : 'ATENA',
        tab_pre: 'VTL01',
        tp_ped: 'VTL01',
        limite_credito: initialCreditLimit,
        credit_limit: initialCreditLimit,
        endereco_entrega_diferente: hasDifferentDelivery,
        has_different_delivery_address: hasDifferentDelivery,
        entrega_cep: hasDifferentDelivery ? deliveryCep : null,
        delivery_zipcode: hasDifferentDelivery ? deliveryCep : null,
        entrega_logradouro: hasDifferentDelivery ? deliveryStreet : null,
        delivery_street: hasDifferentDelivery ? deliveryStreet : null,
        entrega_numero: hasDifferentDelivery ? deliveryNumber : null,
        delivery_number: hasDifferentDelivery ? deliveryNumber : null,
        entrega_bairro: hasDifferentDelivery ? deliveryNeighborhood : null,
        delivery_neighborhood: hasDifferentDelivery ? deliveryNeighborhood : null,
        entrega_complemento: hasDifferentDelivery ? deliveryComplement : null,
        delivery_complement: hasDifferentDelivery ? deliveryComplement : null,
        entrega_cidade: hasDifferentDelivery ? deliveryCity : null,
        delivery_city: hasDifferentDelivery ? deliveryCity : null,
        entrega_uf: hasDifferentDelivery ? deliveryState : null,
        delivery_state: hasDifferentDelivery ? deliveryState : null,
        doc_contrato_social_url: docContractUrl,
        doc_contract_url: docContractUrl,
        doc_identificacao_url: docPartnerPhotoUrl || docCrmvUrl,
        doc_photo_id_url: docPartnerPhotoUrl || docCrmvUrl,
        doc_crmv_url: docCrmvUrl,
        doc_comprovante_endereco_url: docAddressUrl,
        doc_address_url: docAddressUrl,
        doc_ie_url: docSintegraUrl,
        doc_sintegra_url: docSintegraUrl,
        doc_jucesp_url: docJucespUrl,
        doc_cenprot_url: docCenprotUrl,
        nire_jucesp: nireJucesp,
        total_protestos: totalProtestos,
        bureau_consulted_at: bureauConsultedAt,
        ip_origem: await getClientIp(),
        termos_aceitos: true,
        terms_accepted: true,
      };

      const result = await registerClientWithAuth(payload, finalPassword);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao registrar cadastro e criar senha.');
      }

      // Sincronização e garantia de persistência dos documentos de Bureau no painel ADM (PJ e PF)
      const createdClientId = result.client?.id;
      if (createdClientId) {
        if (docJucespUrl || docCenprotUrl || docSintegraUrl || nireJucesp || totalProtestos !== null || bureauConsultedAt) {
          updateClientData(createdClientId, {
            doc_jucesp_url: docJucespUrl,
            doc_cenprot_url: docCenprotUrl,
            doc_ie_url: docSintegraUrl,
            doc_sintegra_url: docSintegraUrl,
            nire_jucesp: nireJucesp,
            total_protestos: totalProtestos,
            bureau_consulted_at: bureauConsultedAt || new Date().toISOString()
          }).catch(err => console.warn('Erro na atualização direta de bureau:', err));
        }

        // Se o documento de protestos ou JUCESP não foi obtido antes, dispara em background com o ID do cliente
        if (!docCenprotUrl || (personType === 'PJ' && !docJucespUrl)) {
          executarAuditoriaBureau({
            id: createdClientId,
            cpf_cnpj: documentNumber,
            razao_social_nome: fullName,
            uf: state || 'SP'
          }).catch(err => console.warn('Execução em background do bureau:', err));
        }
      }

      // Atualiza o e-mail no formulário caso tenha sido ajustado na modal
      if (finalEmail !== email) {
        setEmail(finalEmail);
      }

      setShowPasswordModal(false);
      if (onSuccess) {
        onSuccess(result.client || payload, result.session);
      }
    } catch (err) {
      setSubmitError(err.message || 'Ocorreu um erro ao enviar seu cadastro. Tente novamente.');
      setShowPasswordModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Regras de bloqueio de formulário:
  // - Bloqueia se o documento já possui cadastro APROVADO no sistema
  // - Para PJ: bloqueia se CNPJ não for informado ou não estiver com situação ATIVA na Receita Federal
  // - Para PF: bloqueia se CRMV não for informado, não estiver ATIVO no CFMV ou divergir do CPF informado
  const isPjBlocked = personType === 'PJ' && (!!duplicateApprovedClient || !cnpjInfo || !cnpjInfo.isAtiva);
  const isPfBlocked = personType === 'PF' && (!!duplicateApprovedClient || !crmvData || !crmvData.isValid || !crmvData.isAtivo || crmvData.isMismatch);
  const isFormBlocked = !!duplicateApprovedClient || (personType === 'PJ' ? isPjBlocked : isPfBlocked);

  return (
    <div className="w-full bg-white rounded-2xl sm:rounded-3xl shadow-elevated border border-slate-100 p-5 sm:p-8 lg:p-10">
      {/* Título do Formulário */}
      <div className="mb-6 sm:mb-8 border-b border-slate-100 pb-5">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-teal tracking-tight">
          Formulário de cadastro
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Insira seus dados para análise de crédito e liberação de acesso imediato.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7">

        {/* ========================================================================= */}
        {/* 1. PRIMEIRO CAMPO OBRIGATÓRIO: TIPO DE PESSOA (FÍSICA OU JURÍDICA)       */}
        {/* ========================================================================= */}
        <div className="bg-slate-50/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
              Tipo de Pessoa <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] font-semibold text-brand-dark bg-brand-green-light border border-brand-green/30 px-2 py-0.5 rounded-md">
              Obrigatório para prosseguir
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Opção Pessoa Jurídica */}
            <button
              type="button"
              onClick={() => handlePersonTypeChange('PJ')}
              className={`flex items-center justify-center gap-2.5 sm:gap-3 py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all duration-200 ${personType === 'PJ'
                ? 'border-brand-green bg-brand-green/10 text-brand-dark shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100/60'
                }`}
            >
              <Building2 className={`w-4 h-4 sm:w-5 sm:h-5 ${personType === 'PJ' ? 'text-brand-green' : 'text-slate-400'}`} />
              <span>Pessoa Jurídica</span>
            </button>

            {/* Opção Pessoa Física */}
            <button
              type="button"
              onClick={() => handlePersonTypeChange('PF')}
              className={`flex items-center justify-center gap-2.5 sm:gap-3 py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all duration-200 ${personType === 'PF'
                ? 'border-brand-green bg-brand-green/10 text-brand-dark shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100/60'
                }`}
            >
              <User className={`w-4 h-4 sm:w-5 sm:h-5 ${personType === 'PF' ? 'text-brand-green' : 'text-slate-400'}`} />
              <span>Pessoa Física</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. DADOS PRINCIPAIS (CPF/CNPJ E VALIDAÇÃO CADASTRAL OBRIGATÓRIA)           */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          {/* Campo CNPJ / CPF e Validações Imediatas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                {personType === 'PJ' ? (
                  <Building2 className="w-4 h-4 text-brand-green" />
                ) : (
                  <User className="w-4 h-4 text-brand-green" />
                )}
                <span>{personType === 'PJ' ? 'CNPJ da Empresa' : 'CPF'}</span>
                <span className="text-red-500">*</span>
              </span>
              {loadingDuplicateCheck && (
                <span className="flex items-center gap-1 text-xs text-amber-600 font-normal">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Verificando duplicidade...
                </span>
              )}
              {!loadingDuplicateCheck && personType === 'PJ' && loadingCnpj && (
                <span className="flex items-center gap-1 text-xs text-brand-green font-normal">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Consultando Receita Federal...
                </span>
              )}
              {!loadingDuplicateCheck && !duplicateApprovedClient && personType === 'PJ' && !loadingCnpj && cnpjInfo?.isAtiva && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5" />
                  CNPJ Ativo
                </span>
              )}
              {duplicateApprovedClient && (
                <span className="flex items-center gap-1 text-xs text-red-600 font-bold bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                  <BadgeAlert className="w-3.5 h-3.5" />
                  Já Cadastrado / Aprovado
                </span>
              )}
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={documentNumber}
                  onChange={handleDocumentChange}
                  onBlur={personType === 'PJ' ? handleCnpjBlur : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && personType === 'PJ') {
                      e.preventDefault();
                      handleCnpjBlur();
                    }
                  }}
                  placeholder={personType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  maxLength={personType === 'PJ' ? 18 : 14}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${duplicateApprovedClient || errors.documentNumber || (personType === 'PJ' && cnpjInfo && !cnpjInfo.isAtiva)
                    ? 'border-red-400 bg-red-50/20'
                    : (personType === 'PJ' && cnpjInfo?.isAtiva ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200')
                    }`}
                />
                {(loadingDuplicateCheck || (personType === 'PJ' && loadingCnpj)) && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Loader2 className="w-4 h-4 text-brand-green animate-spin" />
                  </div>
                )}
              </div>

              {personType === 'PJ' && (
                <button
                  type="button"
                  onClick={() => {
                    const clean = unmask(documentNumber);
                    if (clean.length === 14) executeCnpjQuery(clean);
                  }}
                  disabled={loadingCnpj || loadingDuplicateCheck || unmask(documentNumber).length !== 14}
                  className="px-4 py-2.5 bg-brand-green hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  title="Consultar situação do CNPJ na Receita Federal"
                >
                  {loadingCnpj ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Search className="w-4 h-4 text-white" />
                  )}
                  <span>Validar CNPJ</span>
                </button>
              )}
            </div>

            {errors.documentNumber && !duplicateApprovedClient && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.documentNumber}</p>
            )}

            {/* ALERTA DE DUPLICIDADE: CLIENTE JÁ APROVADO NO SISTEMA */}
            {duplicateApprovedClient && (
              <div className="p-4 rounded-xl bg-red-50 border-2 border-red-300 text-xs text-red-900 space-y-2 animate-shake mt-2 shadow-xs">
                <div className="flex items-center gap-2 font-extrabold text-red-700 text-sm">
                  <BadgeAlert className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <span>Cliente Já Cadastrado e Aprovado</span>
                </div>
                <p className="text-xs text-red-800 leading-relaxed">
                  Este {personType === 'PJ' ? 'CNPJ' : 'CPF'} já possui cadastro com status <strong className="uppercase font-bold text-red-950">APROVADO</strong> e integrado em nosso sistema
                  {duplicateApprovedClient?.razao_social_nome ? ` (${duplicateApprovedClient.razao_social_nome})` : ''}.
                </p>
                <div className="p-2.5 rounded-lg bg-red-100/70 border border-red-200 text-[11px] text-red-900 font-medium">
                  🔒 Por conformidade e integração com o sistema ERP, <strong>não é permitido reenviar novo cadastro</strong> para clientes que já foram aprovados. Se precisar de alteração cadastral ou atendimento, entre em contato com seu vendedor ou com a equipe de suporte.
                </div>
              </div>
            )}

            {/* Status e Feedback da Consulta na Receita Federal (PJ) */}
            {!duplicateApprovedClient && personType === 'PJ' && loadingCnpj && (
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-brand-dark flex items-center gap-2 animate-fade-in mt-2">
                <Loader2 className="w-4 h-4 text-brand-green animate-spin flex-shrink-0" />
                <span>Consultando situação cadastral na Receita Federal...</span>
              </div>
            )}

            {!duplicateApprovedClient && personType === 'PJ' && !loadingCnpj && cnpjInfo && !cnpjInfo.isAtiva && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs text-red-800 space-y-1 animate-shake mt-2">
                <div className="flex items-center gap-2 font-bold text-red-700">
                  <BadgeAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>CNPJ Inativo / Não Permitido na Receita Federal</span>
                </div>
                <p>
                  Situação cadastral retornada: <strong className="uppercase font-bold text-red-900">{cnpjInfo.situacaoCadastral || 'Inapta / Inativa'}</strong>.
                </p>
                <p className="text-[11px] text-red-700">
                  O credenciamento de Pessoa Jurídica (PJ) exige CNPJ com situação cadastral <strong>Ativa</strong> na Receita Federal. Os demais campos do formulário permanecerão bloqueados até que um CNPJ ativo seja informado.
                </p>
              </div>
            )}

            {!duplicateApprovedClient && personType === 'PJ' && !loadingCnpj && cnpjInfo?.isAtiva && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-800 space-y-1 animate-fade-in mt-2">
                <div className="flex items-center gap-2 font-bold text-emerald-700">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>CNPJ Ativo na Receita Federal</span>
                </div>
                <p className="text-emerald-900">
                  Razão Social: <strong className="font-semibold">{cnpjInfo.razaoSocial || fullName}</strong> | CNPJ: <strong className="font-semibold">{documentNumber}</strong>
                </p>
                <p className="text-[11px] text-emerald-700">
                  Empresa validada com sucesso! Os campos abaixo foram liberados para preenchimento.
                </p>
              </div>
            )}

            {!duplicateApprovedClient && personType === 'PJ' && !loadingCnpj && !cnpjInfo && (
              <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-[11px] text-blue-800 flex items-start gap-2 mt-2">
                <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>
                  Digite o CNPJ da empresa e clique em <strong>Validar CNPJ</strong> (ou saia do campo). Os demais campos do cadastro serão liberados assim que a situação <strong>ATIVA</strong> for confirmada na Receita Federal.
                </span>
              </div>
            )}
          </div>

          {/* DEMAIS CAMPOS DE IDENTIFICAÇÃO (RAZÃO SOCIAL, INSCRIÇÃO OU NOME/CRMV) */}
          {/* PARA PJ: SÓ APARECE SE O CNPJ ESTIVER ATIVO E NÃO DUPLICADO */}
          {personType === 'PJ' && !isPjBlocked && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 pt-2 animate-fade-in">
              {/* Razão Social */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Razão Social da Empresa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors(prev => ({ ...prev, fullName: null }));
                  }}
                  placeholder="Razão Social da Empresa"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.fullName ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                />
                {errors.fullName && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.fullName}</p>
                )}
              </div>

              {/* Tipo de Inscrição */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tipo de Inscrição <span className="text-red-500">*</span>
                </label>
                <select
                  value={tpInscricao}
                  onChange={(e) => {
                    const newTp = e.target.value;
                    setTpInscricao(newTp);
                    if (newTp === 'I') {
                      setNumeroInscricao('ISENTO');
                    } else if (numeroInscricao === 'ISENTO') {
                      setNumeroInscricao('');
                    }
                    if (errors.tpInscricao) setErrors(prev => ({ ...prev, tpInscricao: null }));
                    if (errors.numeroInscricao) setErrors(prev => ({ ...prev, numeroInscricao: null }));
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all cursor-pointer ${errors.tpInscricao ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                >
                  <option value="E">Estadual</option>
                  <option value="I">Isento</option>
                  <option value="M">Municipal</option>
                </select>
                {errors.tpInscricao && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.tpInscricao}</p>
                )}
              </div>

              {/* Número da Inscrição */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Número da Inscrição {tpInscricao !== 'I' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={tpInscricao === 'I' ? 'ISENTO' : numeroInscricao}
                  disabled={tpInscricao === 'I'}
                  readOnly={tpInscricao === 'I'}
                  onChange={(e) => {
                    setNumeroInscricao(e.target.value);
                    if (errors.numeroInscricao) setErrors(prev => ({ ...prev, numeroInscricao: null }));
                  }}
                  placeholder={tpInscricao === 'I' ? 'ISENTO' : (tpInscricao === 'E' ? 'Número da Inscrição Estadual' : 'Número da Inscrição Municipal')}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 transition-all ${tpInscricao === 'I'
                    ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 font-medium'
                    : 'bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green ' +
                    (errors.numeroInscricao ? 'border-red-400 bg-red-50/20' : 'border-slate-200')
                    }`}
                />
                {errors.numeroInscricao && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.numeroInscricao}</p>
                )}
              </div>
            </div>
          )}

          {/* PARA PF: RENDERIZA NOME COMPLETO E CRMV COM BOTÃO DE VALIDAÇÃO */}
          {personType === 'PF' && !duplicateApprovedClient && (
            <div className="space-y-4 pt-2 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                {/* Nome Completo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-brand-green" />
                      <span>Nome Completo</span>
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors(prev => ({ ...prev, fullName: null }));
                    }}
                    placeholder="Nome Completo do Médico(a) Veterinário(a)"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.fullName ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                      }`}
                  />
                  {errors.fullName && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.fullName}</p>
                  )}
                </div>

                {/* CRMV (Registro Profissional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-brand-green" />
                      <span>CRMV (Registro Profissional)</span>
                      <span className="text-red-500">*</span>
                    </span>
                    {loadingCrmv && (
                      <span className="flex items-center gap-1 text-xs text-brand-green font-normal">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Consultando CFMV...
                      </span>
                    )}
                    {!loadingCrmv && crmvData?.isAtivo && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle className="w-3.5 h-3.5" />
                        CRMV Ativo
                      </span>
                    )}
                  </label>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={crmv}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCrmv(v);
                          setCrmvData(null);
                          setCrmvAlert('');
                          if (errors.crmv) setErrors(prev => ({ ...prev, crmv: null }));
                        }}
                        onBlur={() => handleCrmvBlur(crmv)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCrmvBlur(crmv);
                          }
                        }}
                        placeholder="Ex: 12345"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.crmv || (crmvData && !crmvData.isAtivo)
                          ? 'border-red-400 bg-red-50/20'
                          : (crmvData?.isAtivo ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200')
                          }`}
                      />
                      {loadingCrmv && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Loader2 className="w-4 h-4 text-brand-green animate-spin" />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCrmvBlur(crmv)}
                      disabled={loadingCrmv || !crmv.trim()}
                      className="px-4 py-2.5 bg-brand-green hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                      title="Consultar situação do CRMV no CFMV"
                    >
                      {loadingCrmv ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Search className="w-4 h-4 text-white" />
                      )}
                      <span>Validar CRMV</span>
                    </button>
                  </div>

                  {errors.crmv && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.crmv}</p>
                  )}
                </div>
              </div>

              {/* Feedback CRMV: Loading */}
              {loadingCrmv && (
                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-brand-dark flex items-center gap-2 animate-fade-in">
                  <Loader2 className="w-4 h-4 text-brand-green animate-spin flex-shrink-0" />
                  <span>Consultando registro do CRMV no Conselho Federal de Medicina Veterinária (CFMV)...</span>
                </div>
              )}

              {/* Feedback CRMV: Inativo, Inválido ou Divergente de CPF */}
              {!loadingCrmv && crmvData && (!crmvData.isAtivo || !crmvData.isValid || crmvData.isMismatch) && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs text-red-800 space-y-1 animate-shake">
                  <div className="flex items-center gap-2 font-bold text-red-700">
                    <BadgeAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span>
                      {crmvData.isMismatch ? 'CRMV Divergente do CPF Cadastrado' : 'CRMV Inativo ou Não Localizado'}
                    </span>
                  </div>
                  <p>
                    Situação / Status: <strong className="uppercase font-bold text-red-900">{crmvData.situacao || 'Inválido / Divergente'}</strong>.
                  </p>
                  <p className="text-[11px] text-red-700">
                    {crmvData.error || 'O credenciamento de Pessoa Física exige CRMV com situação Ativa e Regular no CFMV pertencente ao CPF do titular.'}
                  </p>
                </div>
              )}

              {/* Feedback CRMV: Ativo / Sucesso */}
              {!loadingCrmv && crmvData?.isAtivo && crmvData?.isValid && !crmvData?.isMismatch && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-800 space-y-1 animate-fade-in">
                  <div className="flex items-center gap-2 font-bold text-emerald-700">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>CRMV Ativo e Vinculado ao Titular no CFMV</span>
                  </div>
                  <p className="text-emerald-900">
                    Profissional: <strong className="font-semibold">{crmvData.nome || fullName}</strong> | CRMV: <strong className="font-semibold">{crmvData.crmv || crmv}</strong> {crmvData.uf ? `(${crmvData.uf})` : ''}
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Registro profissional validado e vinculado ao titular com sucesso! Os campos abaixo foram liberados para preenchimento.
                  </p>
                </div>
              )}

              {/* Feedback CRMV: Dica Inicial */}
              {!loadingCrmv && !crmvData && (
                <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-[11px] text-blue-800 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>
                    Digite o número do seu <strong>CRMV</strong> e clique em <strong>Validar CRMV</strong> (ou saia do campo). Os demais campos do cadastro serão liberados assim que a situação <strong>ATIVA</strong> for confirmada no Conselho Federal de Medicina Veterinária.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BLOQUEIO DE CAMPOS SE DUPLICADO APROVADO, CNPJ (PJ) OU CRMV (PF) NÃO ESTIVER ATIVO */}
        {isFormBlocked ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-amber-50/70 border-2 border-dashed border-amber-200 text-center space-y-3 animate-fade-in my-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto shadow-2xs ${duplicateApprovedClient ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
              }`}>
              {duplicateApprovedClient ? (
                <BadgeAlert className="w-6 h-6 text-red-600" />
              ) : personType === 'PJ' ? (
                <Building2 className="w-6 h-6 text-amber-600" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <h4 className="text-base font-bold text-slate-800">
              {duplicateApprovedClient ? (
                <span className="text-red-700 font-extrabold">Cadastro Bloqueado: Documento Já Aprovado no Sistema</span>
              ) : personType === 'PJ' ? (
                cnpjInfo && !cnpjInfo.isAtiva
                  ? `Campos bloqueados: CNPJ ${cnpjInfo.situacaoCadastral || 'Inativo'} na Receita Federal`
                  : 'Campos bloqueados: Validação de CNPJ Ativo Obrigatória'
              ) : (
                crmvData && !crmvData.isAtivo
                  ? 'Campos bloqueados: CRMV Inativo / Não Regular no CFMV'
                  : 'Campos bloqueados: Validação de CRMV Obrigatória'
              )}
            </h4>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              {duplicateApprovedClient ? (
                'Não é possível prosseguir pois este documento já possui cadastro aprovado e integrado no sistema. Para solicitar novos pedidos ou alterações, entre em contato com seu representante comercial.'
              ) : personType === 'PJ' ? (
                cnpjInfo && !cnpjInfo.isAtiva
                  ? `O CNPJ informado consta com situação cadastral "${cnpjInfo.situacaoCadastral}" na Receita Federal. O cadastro na plataforma é permitido exclusivamente para empresas com situação ATIVA.`
                  : 'Para prosseguir com o credenciamento de Pessoa Jurídica, digite o CNPJ da empresa acima (14 dígitos) para confirmar a situação ATIVA na Receita Federal e desbloquear os dados de inscrição, contato, endereço e envio de documentos.'
              ) : (
                crmvData && !crmvData.isAtivo
                  ? `O CRMV informado consta como "${crmvData.situacao || 'Inativo'}" no Conselho de Medicina Veterinária. É necessário informar um CRMV ativo e regular para liberar o formulário.`
                  : 'Para prosseguir com o credenciamento de Pessoa Física, digite seu CRMV acima e clique em "Validar CRMV" para desbloquear os dados de contato, endereço e envio de documentos.'
              )}
            </p>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 3. CONTATO E SEGMENTO (DISTRIBUIÇÃO EM 2 COLUNAS ESPAÇOSAS)               */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {/* Telefone / WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1 whitespace-nowrap">
                  <Phone className="w-3.5 h-3.5 text-brand-green flex-shrink-0" />
                  <span>WhatsApp / Telefone</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => {
                    setPhone(maskPhone(e.target.value));
                    if (errors.phone) setErrors(prev => ({ ...prev, phone: null }));
                  }}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.phone ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                />
                {errors.phone && <p className="text-xs text-red-500 mt-1 font-medium">{errors.phone}</p>}
              </div>

              {/* E-mail para Faturamento */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                  <span>E-mail para Faturamento</span>
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors(prev => ({ ...prev, email: null }));
                  }}
                  placeholder="ex: contato@empresa.com.br"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.email ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1 font-medium">{errors.email}</p>}
              </div>

              {/* Segmento de Atuação (Largura Total na linha) */}
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <span>Segmento de Atuação</span>
                    <span className="text-red-500">*</span>
                  </label>

                  {/* Tooltip / Botão de Guia de Segmentos */}
                  <button
                    type="button"
                    onClick={() => setShowSegmentModal(true)}
                    className="group inline-flex items-center gap-1.5 text-xs font-semibold text-brand-green hover:text-emerald-700 bg-emerald-50/90 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200/70 transition-all cursor-pointer shadow-2xs"
                    title="Dúvida de qual segmento escolher? Clique aqui para abrir o guia explicativo"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-brand-green group-hover:scale-110 transition-transform shrink-0" />
                    <span className="underline decoration-dotted underline-offset-2">Dúvida de qual segmento escolher? Clique aqui</span>
                  </button>
                </div>
                <select
                  value={segment}
                  onChange={(e) => {
                    setSegment(e.target.value);
                    if (errors.segment) setErrors(prev => ({ ...prev, segment: null }));
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all cursor-pointer ${errors.segment ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                    }`}
                >
                  <option value="">
                    {loadingSegments ? 'Carregando segmentos...' : 'Selecione o segmento de atuação...'}
                  </option>
                  {segmentsList.map((s) => (
                    <option key={s.ram_ativ} value={s.ram_ativ}>
                      {s.descricao}
                    </option>
                  ))}
                </select>
                {errors.segment && <p className="text-xs text-red-500 mt-1 font-medium">{errors.segment}</p>}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 4. ATENDIMENTO POR VENDEDOR                                              */}
            {/* ========================================================================= */}
            <div className={`bg-slate-50/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3.5 relative ${isSalespersonDropdownOpen ? 'z-50' : 'z-20'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="block text-xs sm:text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-brand-green" />
                  <span>Foi atendido por algum vendedor?</span>
                  <span className="text-red-500">*</span>
                </label>
                {hasSalesperson && (
                  <span className="text-[11px] font-medium text-brand-teal">
                    Selecione o vendedor abaixo
                  </span>
                )}
              </div>

              {/* Botões de Escolha: Não / Sim */}
              <div className="grid grid-cols-2 gap-3 max-w-xs sm:max-w-sm">
                <button
                  type="button"
                  onClick={() => {
                    setHasSalesperson(false);
                    setSelectedSalespersonCode('');
                    setSalespersonSearch('');
                    setIsSalespersonDropdownOpen(false);
                    if (errors.salesperson) setErrors((prev) => ({ ...prev, salesperson: null }));
                  }}
                  className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${!hasSalesperson
                    ? 'border-brand-green bg-brand-green/10 text-brand-dark shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100/60'
                    }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full transition-colors ${!hasSalesperson ? 'bg-brand-green' : 'bg-slate-300'}`}></span>
                  <span>Não</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setHasSalesperson(true);
                    setIsSalespersonDropdownOpen(true);
                    if (salespeopleList.length === 0) {
                      loadSalespeopleData(true);
                    }
                  }}
                  className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${hasSalesperson
                    ? 'border-brand-green bg-brand-green/10 text-brand-dark shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100/60'
                    }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full transition-colors ${hasSalesperson ? 'bg-brand-green' : 'bg-slate-300'}`}></span>
                  <span>Sim</span>
                </button>
              </div>

              {/* Campo de Busca Interativa de Vendedor (Quando marcado Sim) */}
              {hasSalesperson && (
                <div className="pt-2 border-t border-slate-200/80 space-y-2 animate-fade-in" ref={salespersonDropdownRef}>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Vendedor Responsável <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {salespeopleList.length > 0 ? `${salespeopleList.length} vendedores disponíveis` : 'Busque por código ou nome'}
                    </span>
                  </div>

                  <div className="relative">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={
                          selectedSalespersonObj && !isSalespersonDropdownOpen && !salespersonSearch
                            ? `[${selectedSalespersonObj.cd_vend}] ${selectedSalespersonObj.nome_vendedor}`
                            : salespersonSearch
                        }
                        onChange={(e) => {
                          setSalespersonSearch(e.target.value);
                          setSelectedSalespersonCode('');
                          setIsSalespersonDropdownOpen(true);
                          if (errors.salesperson) setErrors((prev) => ({ ...prev, salesperson: null }));
                        }}
                        onFocus={() => {
                          setIsSalespersonDropdownOpen(true);
                          if (salespeopleList.length === 0) {
                            loadSalespeopleData(true);
                          }
                        }}
                        placeholder="Digite o código ou nome do vendedor (ex: ADILSON, CARLOS...)"
                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.salesperson ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                          }`}
                      />

                      {(selectedSalespersonCode || salespersonSearch) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSalespersonCode('');
                            setSalespersonSearch('');
                            setIsSalespersonDropdownOpen(true);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 font-bold text-xs cursor-pointer"
                          title="Limpar seleção"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Dropdown Flutuante de Seleção */}
                    {isSalespersonDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                        {loadingSalespeople ? (
                          <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-brand-green" />
                            <span>Carregando vendedores cadastrados...</span>
                          </div>
                        ) : filteredSalespeople.length > 0 ? (
                          <>
                            <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium px-3 sticky top-0 z-10 backdrop-blur-xs">
                              <span>{filteredSalespeople.length} {filteredSalespeople.length === 1 ? 'vendedor' : 'vendedores'}</span>
                              {salespersonSearch.trim() && (
                                <span>Filtrado por: "{salespersonSearch}"</span>
                              )}
                            </div>
                            {filteredSalespeople.map((vend) => {
                              const isSelected = selectedSalespersonCode === vend.cd_vend;
                              return (
                                <div
                                  key={vend.cd_vend}
                                  onClick={() => {
                                    setSelectedSalespersonCode(vend.cd_vend);
                                    setSalespersonSearch('');
                                    setIsSalespersonDropdownOpen(false);
                                    if (errors.salesperson) setErrors((prev) => ({ ...prev, salesperson: null }));
                                  }}
                                  className={`px-4 py-2.5 hover:bg-brand-green-light/40 flex items-center justify-between transition-colors cursor-pointer text-xs sm:text-sm ${isSelected ? 'bg-brand-green-light/60 font-bold text-brand-dark' : 'text-slate-700'
                                    }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="font-mono px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex-shrink-0">
                                      {vend.cd_vend}
                                    </span>
                                    <span className="truncate">{vend.nome_vendedor}</span>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle className="w-4 h-4 text-brand-green flex-shrink-0 ml-2" />
                                  )}
                                </div>
                              );
                            })}
                          </>
                        ) : salespeopleList.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500 space-y-2">
                            <p>Nenhum vendedor carregado no momento.</p>
                            <button
                              type="button"
                              onClick={() => loadSalespeopleData(true)}
                              className="px-3 py-1.5 bg-brand-green text-white rounded-lg text-xs font-semibold hover:bg-brand-dark transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Loader2 className={`w-3 h-3 ${loadingSalespeople ? 'animate-spin' : 'hidden'}`} />
                              Recarregar vendedores
                            </button>
                          </div>
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-400">
                            Nenhum vendedor encontrado com o termo "{salespersonSearch}".
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {errors.salesperson && (
                    <p className="text-xs text-red-500 font-medium">{errors.salesperson}</p>
                  )}

                  {selectedSalespersonObj && (
                    <div className="flex items-center gap-2 p-2 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium">
                      <UserCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>
                        Vendedor selecionado: <strong>[{selectedSalespersonObj.cd_vend}] {selectedSalespersonObj.nome_vendedor}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* 5. ENDEREÇO PRINCIPAL / CADASTRAL (COM BUSCA AUTOMÁTICA POR CEP)          */}
            {/* ========================================================================= */}
            <div className="bg-slate-50/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4 relative z-10">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-brand-green flex-shrink-0" />
                  <label className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">
                    Endereço Principal / Cadastral <span className="text-red-500">*</span>
                  </label>
                </div>

                {(zipcode || street || number || neighborhood || city || state || complement) && (
                  <button
                    type="button"
                    onClick={handleClearMainAddress}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap shadow-2xs hover:shadow-xs active:scale-95 flex-shrink-0"
                    title="Apagar todos os campos de endereço preenchidos"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                    <span>Limpar endereço</span>
                  </button>
                )}
              </div>

              {/* 1º CAMPO EM DESTAQUE: CEP COM INFORMAÇÃO EXPLICATIVA */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center">
                  {/* Campo CEP */}
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>1. Digite o CEP <span className="text-red-500">*</span></span>
                      {loadingMainCep && (
                        <span className="text-[10px] text-brand-teal font-normal flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={zipcode}
                        onChange={handleMainCepChange}
                        placeholder="00000-000"
                        maxLength={9}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold text-slate-800 placeholder-slate-400 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.zipcode ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                          }`}
                      />
                      {loadingMainCep && (
                        <Loader2 className="w-4 h-4 animate-spin text-brand-teal absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                    </div>
                    {errors.zipcode && <p className="text-xs text-red-500 mt-1 font-medium">{errors.zipcode}</p>}
                    {mainCepError && <p className="text-xs text-amber-600 mt-1 font-medium">{mainCepError}</p>}
                  </div>

                  {/* Informação / Instrução de busca rápida */}
                  <div className="sm:col-span-8 flex items-start gap-2.5 p-3 rounded-xl bg-brand-green-light/40 border border-brand-green/20 text-xs text-brand-dark">
                    <Info className="w-4 h-4 text-brand-green flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">
                        Preencha o CEP para buscar os dados de endereço
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Ao digitar o CEP, os dados de Rua, Bairro, Cidade e Estado são preenchidos automaticamente abaixo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* DEMAIS CAMPOS DO ENDEREÇO (RUA, NÚMERO, COMPLEMENTO, BAIRRO, CIDADE, UF) */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {/* Rua / Logradouro */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Rua / Logradouro <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => {
                        setStreet(e.target.value);
                        if (errors.street) setErrors(prev => ({ ...prev, street: null }));
                      }}
                      placeholder="Ex: Av. Paulista, Rua das Palmeiras..."
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.street ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                        }`}
                    />
                    {errors.street && <p className="text-xs text-red-500 mt-1 font-medium">{errors.street}</p>}
                  </div>

                  {/* Número */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Número <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={number}
                      onChange={(e) => {
                        setNumber(e.target.value);
                        if (errors.number) setErrors(prev => ({ ...prev, number: null }));
                      }}
                      placeholder="Ex: 123 ou S/N"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.number ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                        }`}
                    />
                    {errors.number && <p className="text-xs text-red-500 mt-1 font-medium">{errors.number}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
                  {/* Complemento */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Complemento
                    </label>
                    <input
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Apto, Sala, Bloco..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all"
                    />
                  </div>

                  {/* Bairro */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Bairro <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={neighborhood}
                      onChange={(e) => {
                        setNeighborhood(e.target.value);
                        if (errors.neighborhood) setErrors(prev => ({ ...prev, neighborhood: null }));
                      }}
                      placeholder="Ex: Centro"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.neighborhood ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                        }`}
                    />
                    {errors.neighborhood && <p className="text-xs text-red-500 mt-1 font-medium">{errors.neighborhood}</p>}
                  </div>

                  {/* Cidade */}
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 truncate">
                      Cidade <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (errors.city) setErrors(prev => ({ ...prev, city: null }));
                      }}
                      placeholder="Cidade"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${errors.city ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                        }`}
                    />
                    {errors.city && <p className="text-xs text-red-500 mt-1 font-medium">{errors.city}</p>}
                  </div>

                  {/* UF */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      UF <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={state}
                      onChange={(e) => {
                        setState(e.target.value.toUpperCase());
                        if (errors.state) setErrors(prev => ({ ...prev, state: null }));
                      }}
                      className={`w-full min-w-[70px] px-2.5 py-2.5 rounded-xl border text-sm font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all cursor-pointer ${errors.state ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                        }`}
                    >
                      <option value="">UF</option>
                      {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                    {errors.state && <p className="text-xs text-red-500 mt-1 font-medium">{errors.state}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 6. ENDEREÇO DE ENTREGA ALTERNATIVO (CONDICIONAL - CHECKBOX)              */}
            {/* ========================================================================= */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasDifferentDelivery}
                    onChange={(e) => setHasDifferentDelivery(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-green focus:ring-emerald-500 border-slate-300"
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-brand-green" />
                    <span>{personType === 'PJ' ? 'Endereço de entrega diferente do endereço principal / cadastral?' : 'Endereço de entrega diferente do endereço principal?'}</span>
                  </span>
                </label>

                {hasDifferentDelivery && (deliveryCep || deliveryStreet || deliveryNumber || deliveryNeighborhood || deliveryCity || deliveryState || deliveryComplement) && (
                  <button
                    type="button"
                    onClick={handleClearDeliveryAddress}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 self-start sm:self-center"
                    title="Limpar endereço de entrega"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Limpar entrega</span>
                  </button>
                )}
              </div>

              {hasDifferentDelivery && (
                <div className="space-y-3 pt-2 border-t border-slate-200/80">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* CEP */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        CEP de Entrega <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={deliveryCep}
                          onChange={handleCepChange}
                          placeholder="00000-000"
                          maxLength={9}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 bg-white ${errors.deliveryCep ? 'border-red-400' : 'border-slate-200'
                            }`}
                        />
                        {loadingCep && <Loader2 className="w-4 h-4 animate-spin text-brand-teal absolute right-3 top-1/2 -translate-y-1/2" />}
                      </div>
                      {cepError && <p className="text-[10px] text-amber-600 mt-1">{cepError}</p>}
                    </div>

                    {/* Logradouro */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Rua / Avenida <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={deliveryStreet}
                        onChange={(e) => setDeliveryStreet(e.target.value)}
                        placeholder="Ex: Av. Veterinária das Nações"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Número *</label>
                      <input
                        type="text"
                        value={deliveryNumber}
                        onChange={(e) => setDeliveryNumber(e.target.value)}
                        placeholder="123"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Bairro</label>
                      <input
                        type="text"
                        value={deliveryNeighborhood}
                        onChange={(e) => setDeliveryNeighborhood(e.target.value)}
                        placeholder="Bairro"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade *</label>
                      <input
                        type="text"
                        value={deliveryCity}
                        onChange={(e) => setDeliveryCity(e.target.value)}
                        placeholder="Cidade"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">UF *</label>
                      <select
                        value={deliveryState}
                        onChange={(e) => setDeliveryState(e.target.value.toUpperCase())}
                        className="w-full min-w-[70px] px-2.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-white cursor-pointer"
                      >
                        <option value="">UF</option>
                        {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* 5. SEÇÃO DE DOCUMENTOS (UPLOAD DOS ANEXOS CONFORME REGRA DE NEGÓCIO)      */}
            {/* ========================================================================= */}
            <div className="space-y-4 pt-2">
              <div className="border-b border-slate-100 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand-green" />
                    <span>Documentos Anexados</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {personType === 'PJ'
                      ? 'Anexe o Contrato Social ou o Documento com Foto de um dos Sócios (obrigatório pelo menos 1).'
                      : 'Para Pessoa Física, o Comprovante de Endereço e o CRMV são ambos obrigatórios.'}
                  </p>
                </div>

                {/* Badge Indicador de Regra */}
                <span className={`text-[11px] font-bold px-3 py-1 rounded-full border self-start sm:self-center whitespace-nowrap flex-shrink-0 ${personType === 'PJ'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}>
                  {personType === 'PJ' ? 'Obrigatório: Pelo menos 1 doc' : 'Obrigatório: Ambos os 2 docs'}
                </span>
              </div>

              {/* Alerta de erro de grupo para PJ se nenhum documento for anexado */}
              {errors.docPJGroup && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center gap-2 animate-shake">
                  <BadgeAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{errors.docPJGroup}</span>
                </div>
              )}

              {/* Grade de Documentos PJ */}
              {personType === 'PJ' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* 1. Contrato Social (PJ) */}
                  <DocumentUpload
                    label="Contrato Social ou Doc. Constitutivo"
                    file={docContract}
                    onFileChange={(f) => {
                      setDocContract(f);
                      if (errors.docContract || errors.docPJGroup) {
                        setErrors(prev => ({ ...prev, docContract: null, docPartnerPhoto: null, docPJGroup: null }));
                      }
                    }}
                    required={!docPartnerPhoto}
                    error={errors.docContract}
                    expectedDocument={documentNumber}
                    expectedName={fullName}
                    expectedPartners={cnpjInfo?.socios || []}
                    category="CONTRACT"
                  />

                  {/* 2. Documento com Foto de um dos Sócios (PJ) */}
                  <DocumentUpload
                    label="Documento com Foto de um dos Sócios (RG/CNH)"
                    file={docPartnerPhoto}
                    onFileChange={(f) => {
                      setDocPartnerPhoto(f);
                      if (errors.docPartnerPhoto || errors.docPJGroup) {
                        setErrors(prev => ({ ...prev, docContract: null, docPartnerPhoto: null, docPJGroup: null }));
                      }
                    }}
                    required={!docContract}
                    error={errors.docPartnerPhoto}
                    expectedDocument={documentNumber}
                    expectedName={fullName}
                    expectedPartners={cnpjInfo?.socios || []}
                    category="IDENTIFICATION"
                  />
                </div>
              ) : (
                /* Grade de Documentos PF (Comprovante de Endereço + CRMV obrigatórios) */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* 1. CRMV (PF) - Obrigatório */}
                  <DocumentUpload
                    label="CRMV (Carteira Profissional do Médico Veterinário)"
                    file={docCRMV}
                    onFileChange={(f) => {
                      setDocCRMV(f);
                      if (errors.docCRMV) setErrors(prev => ({ ...prev, docCRMV: null }));
                    }}
                    required={true}
                    error={errors.docCRMV}
                    expectedDocument={documentNumber}
                    expectedName={fullName}
                    expectedCrmv={crmv}
                    category="CRMV"
                  />

                  {/* 2. Comprovante de Endereço (PF) - Obrigatório */}
                  <DocumentUpload
                    label="Comprovante de Endereço (Recente - até 90 dias)"
                    file={docAddress}
                    onFileChange={(f) => {
                      setDocAddress(f);
                      if (errors.docAddress) setErrors(prev => ({ ...prev, docAddress: null }));
                    }}
                    required={true}
                    error={errors.docAddress}
                    expectedDocument={documentNumber}
                    expectedName={fullName}
                    category="ADDRESS"
                  />
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* 6. BOX INFORMATIVO DE ENTREGAS (CALLOUT AZUL)                             */}
            {/* ========================================================================= */}
            <div className="rounded-xl bg-[#eff6ff] border border-blue-200/70 p-4 sm:p-4 flex items-start gap-3 text-blue-900">
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0 mt-0.5">
                <Info className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs sm:text-xs leading-relaxed">
                <span className="font-bold">Realizamos entregas em endereço diferente do CNPJ.</span>{' '}
                <span className="text-blue-800">Para saber mais sobre as condições e regras, acesse nossos </span>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="font-bold underline text-blue-900 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Termos de Entrega</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
                .
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 7. CHECKBOX DE ACEITE DOS TERMOS                                         */}
            {/* ========================================================================= */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => {
                    setAgreedTerms(e.target.checked);
                    if (errors.agreedTerms) setErrors(prev => ({ ...prev, agreedTerms: null }));
                  }}
                  className="mt-1 w-4 h-4 rounded text-brand-green focus:ring-emerald-500 border-slate-300"
                />
                <span className="text-xs sm:text-sm text-slate-700 leading-snug">
                  Li e concordo com os{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTermsModal(true);
                    }}
                    className="font-bold text-[#0b3b60] hover:underline"
                  >
                    Termos de Entrega
                  </button>{' '}
                  da Vetline. <span className="text-red-500">*</span>
                </span>
              </label>
              {errors.agreedTerms && (
                <p className="text-[11px] text-red-500 mt-1 ml-7 font-medium">{errors.agreedTerms}</p>
              )}
            </div>

            {/* Mensagem de Erro Geral */}
            {submitError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 8. BOTÃO DE ENVIO                                                         */}
            {/* ========================================================================= */}
            <button
              type="submit"
              disabled={isSubmitting || isValidatingPartnerDoc}
              style={{ backgroundColor: '#1d5b79', color: '#ffffff' }}
              className="w-full py-4 px-6 rounded-xl bg-[#1d5b79] hover:bg-[#144258] active:scale-[0.99] !text-white font-bold text-base sm:text-lg tracking-wide shadow-lg shadow-[#1d5b79]/30 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isValidatingPartnerDoc ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span className="text-white font-bold">Validando documento e sócios...</span>
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span className="text-white font-bold">Enviando dados e documentos...</span>
                </>
              ) : (
                <span className="text-white font-bold">Enviar cadastro</span>
              )}
            </button>
          </>
        )}
      </form>

      {/* Modal de Termos */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setAgreedTerms(true)}
      />

      {/* Modal de Criação de Senha de Acesso */}
      <CreatePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        email={email}
        fullName={fullName}
        onSubmit={handlePasswordSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Modal de Ajuda de Segmento */}
      <SegmentHelpModal
        isOpen={showSegmentModal}
        onClose={() => setShowSegmentModal(false)}
        currentValue={segment}
        onSelectSegment={handleSelectSegmentFromModal}
      />

      {/* Modal de Alerta de Divergência de Sócio no QSA ou SINTEGRA */}
      <PartnerMismatchModal
        isOpen={showPartnerMismatchModal}
        onClose={() => {
          setShowPartnerMismatchModal(false);
          if (partnerMismatchData?.shouldResetForm) {
            resetForm();
          }
        }}
        title={partnerMismatchData?.title}
        subtitle={partnerMismatchData?.subtitle}
        reasons={partnerMismatchData?.reasons || []}
        authorizedPartners={partnerMismatchData?.authorizedPartners || []}
        buttonText={partnerMismatchData?.buttonText || 'Reenviar Documentos'}
        hideReupload={Boolean(partnerMismatchData?.hideReupload)}
        closeButtonText={partnerMismatchData?.closeButtonText || 'Fechar formulário'}
        onReupload={() => {
          setShowPartnerMismatchModal(false);
          const uploadEls = document.querySelectorAll('input[type="file"]');
          if (uploadEls && uploadEls.length > 0) {
            uploadEls[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
      />

      {/* Modal de Aviso de Cliente Já Aprovado (Duplicidade Proibida) */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-red-100 space-y-5 animate-scale-in">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 shadow-xs">
                <BadgeAlert className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                    Cadastro Existente
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDuplicateModal(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Cliente já cadastrado e aprovado
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Documento:</span>
                <span className="font-mono font-bold text-slate-800">{documentNumber}</span>
              </div>
              {duplicateApprovedClient?.razao_social_nome && (
                <div className="flex justify-between items-start text-slate-600 gap-2">
                  <span className="font-medium">Razão Social / Nome:</span>
                  <span className="font-bold text-slate-800 text-right">{duplicateApprovedClient.razao_social_nome}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Status no Sistema:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md uppercase text-[10px]">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  Aprovado / Integrado via Webhook
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Este {personType === 'PJ' ? 'CNPJ' : 'CPF'} já concluiu com sucesso o processo de credenciamento e seus dados estão ativos no ERP. Por regras de conformidade, <strong>não é permitido reenviar um novo cadastro</strong> para o mesmo documento.
            </p>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                Para solicitar compras, alteração cadastral ou suporte, entre em contato diretamente com seu vendedor ou com nossa central.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-green hover:bg-emerald-600 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer text-center"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
