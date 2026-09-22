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
import { executarAuditoriaBureau, consultarSintegra } from '../lib/infosimples';
import { validatePartnerDocument } from '../utils/documentValidator';
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
import { uploadDocument, submitNewClient, updateClientData, fetchSalespeople } from '../lib/supabase';

export const RegistrationForm = ({ onSuccess }) => {
  // Estado do formulário
  const [personType, setPersonType] = useState('PJ'); // 'PJ' ou 'PF'
  
  // Dados principais
  const [documentNumber, setDocumentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [segment, setSegment] = useState('');
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

  // Reset de documento ao trocar tipo de pessoa
  const handlePersonTypeChange = (type) => {
    setPersonType(type);
    setDocumentNumber('');
    setFullName('');
    setCnpjInfo(null);
    setCnpjAlert('');
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

  // Formatação automática do documento e busca na BrasilAPI para CNPJ
  const handleDocumentChange = async (e) => {
    const val = e.target.value;
    const formatted = personType === 'PJ' ? maskCNPJ(val) : maskCPF(val);
    setDocumentNumber(formatted);
    setCnpjAlert('');
    if (errors.documentNumber) {
      setErrors((prev) => ({ ...prev, documentNumber: null }));
    }

    const clean = unmask(formatted);
    if (personType === 'PJ' && clean.length === 14 && isValidCNPJ(clean)) {
      setLoadingCnpj(true);
      const data = await fetchCNPJDataFromBrasilAPI(clean);
      setLoadingCnpj(false);
      if (data) {
        setCnpjInfo(data);
        if (data.razaoSocial) {
          setFullName(data.razaoSocial);
          if (errors.fullName) setErrors(prev => ({ ...prev, fullName: null }));
        }
        if (data.suggestedSegment && !segment) {
          setSegment(data.suggestedSegment);
          if (errors.segment) setErrors(prev => ({ ...prev, segment: null }));
        }
        if (data.telefone && !phone) {
          setPhone(data.telefone);
          if (errors.phone) setErrors(prev => ({ ...prev, phone: null }));
        }
        if (data.email && !email) {
          setEmail(data.email);
          if (errors.email) setErrors(prev => ({ ...prev, email: null }));
        }
        // Auto-preenchimento do Endereço Principal via Receita Federal
        if (data.endereco) {
          if (data.endereco.cep) setZipcode(maskCEP(data.endereco.cep));
          if (data.endereco.logradouro) setStreet(data.endereco.logradouro);
          if (data.endereco.numero) setNumber(data.endereco.numero);
          if (data.endereco.complemento) setComplement(data.endereco.complemento);
          if (data.endereco.bairro) setNeighborhood(data.endereco.bairro);
          if (data.endereco.municipio) setCity(data.endereco.municipio);
          if (data.endereco.uf) setState(data.endereco.uf);
          setMainCepError('');
          setErrors(prev => ({
            ...prev,
            zipcode: null,
            street: null,
            number: null,
            neighborhood: null,
            city: null,
            state: null
          }));
        }
        if (!data.isAtiva) {
          setCnpjAlert(`Atenção: Este CNPJ consta como ${data.situacaoCadastral} na Receita Federal.`);
        }

        // Dispara antecipadamente a consulta na JUCESP e CENPROT em segundo plano
        bureauAuditResultRef.current = null;
        bureauAuditPromiseRef.current = executarAuditoriaBureau({
          cpf_cnpj: clean,
          razao_social_nome: data?.razaoSocial || fullName
        }).then(res => {
          bureauAuditResultRef.current = res;
          return res;
        }).catch(err => {
          console.warn('Pré-consulta Bureau:', err);
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

    // 2. CPF / CNPJ
    const cleanDoc = unmask(documentNumber);
    if (personType === 'PJ') {
      if (!cleanDoc || cleanDoc.length !== 14 || !isValidCNPJ(cleanDoc)) {
        newErrors.documentNumber = 'Informe um CNPJ válido.';
      }
    } else {
      if (!cleanDoc || cleanDoc.length !== 11 || !isValidCPF(cleanDoc)) {
        newErrors.documentNumber = 'Informe um CPF válido.';
      }
    }

    // 3. Razão Social / Nome Completo
    if (!fullName.trim()) {
      newErrors.fullName = personType === 'PJ' ? 'Informe a Razão Social.' : 'Informe o Nome Completo.';
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

    if (!validateForm()) {
      // Rola suavemente até o primeiro erro se houver
      const firstErrorEl = document.querySelector('.border-red-400, .text-red-600, .bg-red-50');
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Validação antecipada do documento do sócio contra o QSA e SINTEGRA (antes de permitir criar senha)
    if (personType === 'PJ') {
      setIsValidatingPartnerDoc(true);
      try {
        // 1. Validação do Documento do Sócio contra o QSA
        if (docPartnerPhoto) {
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

          if (partners.length > 0) {
            const partnerCheck = await validatePartnerDocument(docPartnerPhoto, partners);
            if (!partnerCheck.isValid) {
              setPartnerMismatchData({
                title: 'O cadastro não foi concluído',
                subtitle: 'Divergência identificada no Quadro Societário (QSA)',
                reasons: partnerCheck.reasons,
                authorizedPartners: partnerCheck.authorizedPartners,
                buttonText: 'Reenviar Documentos do Sócio'
              });
              setShowPartnerMismatchModal(true);
              setIsValidatingPartnerDoc(false);
              return;
            }
          }
        }

        // 2. Validação do SINTEGRA / Inscrição Estadual (SEFAZ)
        const cleanCnpj = unmask(documentNumber);
        const ufState = state || cnpjInfo?.uf || 'SP';

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

        const isHabilitado = Boolean(
          sintegraRes &&
          sintegraRes.success &&
          String(sintegraRes.situacaoCadastral || '').trim().toLowerCase() === 'habilitado'
        );

        if (!isHabilitado) {
          const sitDesc = sintegraRes?.situacaoCadastral || sintegraRes?.error || 'Não Habilitado';
          setPartnerMismatchData({
            title: 'Cadastro Impedido - SINTEGRA',
            subtitle: 'Situação Cadastral no SINTEGRA diferente de "Habilitado"',
            reasons: [
              `Situação Cadastral no SINTEGRA: "${sitDesc}".`,
              'O cadastro como Pessoa Jurídica (PJ) só é permitido quando a Situação Cadastral no SINTEGRA constar estritamente como "Habilitado".',
              `Qualquer situação diferente de "Habilitado" impede a conclusão do cadastro no estado de ${sintegraRes?.uf || ufState}.`
            ],
            authorizedPartners: [],
            buttonText: 'Revisar Dados do Formulário'
          });
          setShowPartnerMismatchModal(true);
          setIsValidatingPartnerDoc(false);
          return;
        }

        sintegraResultRef.current = sintegraRes;
      } catch (checkErr) {
        console.warn('Erro ao validar sócio e sintegra antecipadamente:', checkErr);
      } finally {
        setIsValidatingPartnerDoc(false);
      }
    }

    // Abre a modal para o cliente criar sua senha de acesso apenas se tudo estiver validado
    setShowPasswordModal(true);
  };

  // Envio final do formulário com e-mail e senha informados na modal
  const handlePasswordSubmit = async (confirmedEmail, password) => {
    setIsSubmitting(true);
    setSubmitError(null);

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

      // Se for PJ, obtém a consulta no Bureau (JUCESP Ficha Simplificada, CENPROT & SINTEGRA)
      let docJucespUrl = null;
      let docCenprotUrl = null;
      let docSintegraUrl = sintegraResultRef.current?.receiptUrl || null;
      let sintegraIe = sintegraResultRef.current?.ie || null;
      let nireJucesp = null;
      let totalProtestos = null;
      let bureauConsultedAt = null;

      if (personType === 'PJ' && documentNumber) {
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
        possui_ie: hasIe,
        has_ie: hasIe,
        numero_ie: sintegraIe || null,
        ie_number: sintegraIe || null,
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
        termos_aceitos: true,
        terms_accepted: true,
      };

      const result = await registerClientWithAuth(payload, finalPassword);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao registrar cadastro e criar senha.');
      }

      // Sincronização e garantia de persistência dos documentos de Bureau no painel ADM
      const createdClientId = result.client?.id;
      if (personType === 'PJ' && createdClientId) {
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

        // Se por qualquer motivo a JUCESP não foi obtida antes, dispara com o ID do cliente criado
        if (!docJucespUrl) {
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
              className={`flex items-center justify-center gap-2.5 sm:gap-3 py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all duration-200 ${
                personType === 'PJ'
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
              className={`flex items-center justify-center gap-2.5 sm:gap-3 py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all duration-200 ${
                personType === 'PF'
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
        {/* 2. DADOS PRINCIPAIS (CPF/CNPJ E NOME/RAZÃO SOCIAL)                       */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* CNPJ ou CPF */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {personType === 'PJ' ? 'CNPJ' : 'CPF'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={documentNumber}
                onChange={handleDocumentChange}
                placeholder={personType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                maxLength={personType === 'PJ' ? 18 : 14}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${
                  errors.documentNumber ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                }`}
              />
              {loadingCnpj && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-brand-teal font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Buscando Receita...</span>
                </div>
              )}
            </div>
            {errors.documentNumber && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.documentNumber}</p>
            )}
            {cnpjAlert && (
              <p className="text-xs text-amber-600 font-medium mt-1">{cnpjAlert}</p>
            )}
          </div>

          {/* Razão Social ou Nome Completo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {personType === 'PJ' ? 'Razão Social' : 'Nome Completo'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors(prev => ({ ...prev, fullName: null }));
              }}
              placeholder={personType === 'PJ' ? 'Razão Social da Empresa' : 'Seu Nome Completo'}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${
                errors.fullName ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
              }`}
            />
            {errors.fullName && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.fullName}</p>
            )}
          </div>
        </div>

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
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${
                errors.phone ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
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
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${
                errors.email ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
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
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all cursor-pointer ${
                errors.segment ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
              }`}
            >
              <option value="">Selecione o segmento de atuação...</option>
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
              className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                !hasSalesperson
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
              className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                hasSalesperson
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
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${
                      errors.salesperson ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
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
                              className={`px-4 py-2.5 hover:bg-brand-green-light/40 flex items-center justify-between transition-colors cursor-pointer text-xs sm:text-sm ${
                                isSelected ? 'bg-brand-green-light/60 font-bold text-brand-dark' : 'text-slate-700'
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
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold text-slate-800 placeholder-slate-400 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${
                      errors.zipcode ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
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
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${
                    errors.street ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
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
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${
                    errors.number ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
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
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${
                    errors.neighborhood ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
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
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all ${
                    errors.city ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
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
                  className={`w-full min-w-[70px] px-2.5 py-2.5 rounded-xl border text-sm font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all cursor-pointer ${
                    errors.state ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                >
                  <option value="">UF</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
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
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-800 bg-white ${
                        errors.deliveryCep ? 'border-red-400' : 'border-slate-200'
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
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
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
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border self-start sm:self-center whitespace-nowrap flex-shrink-0 ${
              personType === 'PJ' 
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
                category="IDENTIFICATION"
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
        onSelectSegment={(val) => {
          setSegment(val);
          if (errors.segment) setErrors(prev => ({ ...prev, segment: null }));
        }}
      />

      {/* Modal de Alerta de Divergência de Sócio no QSA */}
      <PartnerMismatchModal
        isOpen={showPartnerMismatchModal}
        onClose={() => setShowPartnerMismatchModal(false)}
        reasons={partnerMismatchData?.reasons || []}
        authorizedPartners={partnerMismatchData?.authorizedPartners || []}
        onReupload={() => {
          setShowPartnerMismatchModal(false);
          const uploadEls = document.querySelectorAll('input[type="file"]');
          if (uploadEls && uploadEls.length > 0) {
            uploadEls[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
      />
    </div>
  );
};
