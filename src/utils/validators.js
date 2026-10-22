import { unmask, maskPhone, maskCEP } from './masks';
import { parseCnae, formatCnaeCode } from './cnaeValidator';

/**
 * Validação real de CPF (Algoritmo Módulo 11)
 */
export const isValidCPF = (cpf) => {
  const clean = unmask(cpf);
  if (clean.length !== 11) return false;
  
  // Elimina CPFs inválidos conhecidos como '00000000000', '11111111111'
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.charAt(10), 10)) return false;

  return true;
};

/**
 * Validação real de CNPJ (Algoritmo Módulo 11)
 */
export const isValidCNPJ = (cnpj) => {
  const clean = unmask(cnpj);
  if (clean.length !== 14) return false;

  // Elimina CNPJs inválidos conhecidos
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let length = clean.length - 2;
  let numbers = clean.substring(0, length);
  const digits = clean.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  length = length + 1;
  numbers = clean.substring(0, length);
  sum = 0;
  pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
};

/**
 * Validação de E-mail
 */
export const isValidEmail = (email) => {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase());
};

export const validateEmail = isValidEmail;

/**
 * Calcula a idade de uma empresa a partir da data de abertura/fundação.
 * Retorna se possui menos de 1 ano de fundação (365 dias) para alerta de retaguarda.
 * @param {string|Date} dateInput Data de abertura em formatos como 'YYYY-MM-DD', 'DD/MM/YYYY' ou Date
 * @returns {{
 *   hasDate: boolean,
 *   isRecent: boolean,
 *   diffDays: number,
 *   ageMonths: number,
 *   ageText: string,
 *   formattedDate: string,
 *   alertText: string|null
 * }}
 */
export const checkCompanyAge = (dateInput) => {
  if (!dateInput) return { hasDate: false, isRecent: false, diffDays: null, ageMonths: null, ageText: '', formattedDate: '', alertText: null };

  let openingDate = null;

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    openingDate = dateInput;
  } else if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return { hasDate: false, isRecent: false, diffDays: null, ageMonths: null, ageText: '', formattedDate: '', alertText: null };

    // Formato DD/MM/YYYY ou DD-MM-YYYY
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(trimmed)) {
      const parts = trimmed.split(/[/-]/);
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      openingDate = new Date(y, m, d);
    } else if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(trimmed)) {
      // Formato YYYY-MM-DD ou YYYY/MM/DD
      const parts = trimmed.split(/[/-]/);
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      openingDate = new Date(y, m, d);
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) openingDate = parsed;
    }
  }

  if (!openingDate || isNaN(openingDate.getTime())) {
    return { hasDate: false, isRecent: false, diffDays: null, ageMonths: null, ageText: '', formattedDate: '', alertText: null };
  }

  const today = new Date();
  const diffTime = today.getTime() - openingDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Diferença em meses
  let months = (today.getFullYear() - openingDate.getFullYear()) * 12 + (today.getMonth() - openingDate.getMonth());
  if (today.getDate() < openingDate.getDate()) {
    months = Math.max(0, months - 1);
  }

  const isRecent = diffDays >= 0 && diffDays < 365;

  const day = String(openingDate.getDate()).padStart(2, '0');
  const month = String(openingDate.getMonth() + 1).padStart(2, '0');
  const year = openingDate.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;

  let ageText = '';
  if (months <= 0) {
    ageText = `${Math.max(0, diffDays)} dia(s)`;
  } else if (months === 1) {
    ageText = '1 mês';
  } else {
    ageText = `${months} meses`;
  }

  return {
    hasDate: true,
    isRecent,
    diffDays,
    ageMonths: months,
    ageText,
    formattedDate,
    alertText: isRecent
      ? `[ALERTA RETAGUARDA: Empresa com menos de 1 ano de fundação (Abertura: ${formattedDate} - ${ageText})]`
      : null
  };
};

/**
 * Consulta de CNPJ exclusivamente via APIs públicas e 100% gratuitas da Receita Federal
 * (Minha Receita, BrasilAPI e CNPJ.ws) sem consumo de créditos
 * @param {string} cnpj 
 * @returns {Promise<Object|null>} Dados completos da empresa ou null
 */
export const fetchCNPJDataFromBrasilAPI = async (cnpj) => {
  const clean = unmask(cnpj);
  if (clean.length !== 14 || !isValidCNPJ(clean)) return null;

  const mapSegment = (cnaeDesc) => {
    const desc = String(cnaeDesc || '').toLowerCase();
    if (desc.includes('veterin')) return 'Clinica Veterinaria';
    if (desc.includes('animais') || desc.includes('pet') || desc.includes('higiene')) return 'Pet Shop';
    if (desc.includes('agropecu') || desc.includes('racao') || desc.includes('sementes')) return 'Agropecuaria';
    if (desc.includes('farmacia') || desc.includes('medicamento')) return 'Farmacia Veterinaria';
    if (desc.includes('distribui') || desc.includes('atacad')) return 'Distribuidora / Revenda';
    return '';
  };

  // Provedor 1: Minha Receita (100% Gratuito - Base oficial aberta da Receita Federal, sem limite estrito)
  try {
    const response = await fetch(`https://minhareceita.org/${clean}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.razao_social) {
        const cnaeCode = formatCnaeCode(data.cnae_fiscal);
        const cnaeDesc = data.cnae_fiscal_descricao || '';
        const fullCnae = cnaeCode && cnaeDesc ? `${cnaeCode} - ${cnaeDesc}` : (cnaeCode || cnaeDesc);

        return {
          razaoSocial: data.razao_social || '',
          nomeFantasia: data.nome_fantasia || '',
          situacaoCadastral: data.descricao_situacao_cadastral || 'ATIVA',
          isAtiva: (data.descricao_situacao_cadastral || '').toUpperCase() === 'ATIVA' || data.situacao_cadastral === 2,
          dataAbertura: data.data_inicio_atividade || '',
          cnaeCodigo: cnaeCode,
          cnaeDescricao: cnaeDesc,
          cnae: fullCnae,
          suggestedSegment: mapSegment(cnaeDesc),
          socios: (data.qsa || data.socios || []).map(s => ({
            nome: s.nome || s.nome_socio || s.nome_do_socio || '',
            qualificacao: s.qualificacao_socio?.descricao || s.qualificacao_socio || s.qualificacao_do_socio || s.qualificacao || '',
            cpf_cnpj_socio: s.cpf_cnpj_socio || s.cnpj_cpf_do_socio || s.cpf_socio || s.cpf_representante_legal || s.cpf || s.documento || '',
            documento: s.cpf_cnpj_socio || s.cnpj_cpf_do_socio || s.cpf_socio || s.cpf_representante_legal || s.cpf || s.documento || '',
            cpfRepresentante: s.cpf_representante_legal || ''
          })),
          endereco: {
            cep: data.cep ? maskCEP(data.cep) : '',
            logradouro: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro || ''}`.trim(),
            numero: data.numero || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            municipio: data.municipio || '',
            uf: (data.uf || '').trim().toUpperCase()
          },
          telefone: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : '',
          email: data.email ? String(data.email).toLowerCase() : ''
        };
      }
    }
  } catch (err) {
    console.warn('Tentando próximo provedor de CNPJ (BrasilAPI)...', err);
  }

  // Provedor 2: BrasilAPI
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.razao_social) {
        const cnaeCode = formatCnaeCode(data.cnae_fiscal);
        const cnaeDesc = data.cnae_fiscal_descricao || '';
        const fullCnae = cnaeCode && cnaeDesc ? `${cnaeCode} - ${cnaeDesc}` : (cnaeCode || cnaeDesc);

        return {
          razaoSocial: data.razao_social || '',
          nomeFantasia: data.nome_fantasia || '',
          situacaoCadastral: data.descricao_situacao_cadastral || 'ATIVA',
          isAtiva: (data.descricao_situacao_cadastral || '').toUpperCase() === 'ATIVA',
          dataAbertura: data.data_inicio_atividade || '',
          cnaeCodigo: cnaeCode,
          cnaeDescricao: cnaeDesc,
          cnae: fullCnae,
          suggestedSegment: mapSegment(cnaeDesc),
          socios: (data.qsa || data.socios || []).map(s => ({
            nome: s.nome || s.nome_socio || s.nome_do_socio || '',
            qualificacao: s.qualificacao_socio?.descricao || s.qualificacao_socio || s.qualificacao_do_socio || s.qualificacao || '',
            cpf_cnpj_socio: s.cpf_cnpj_socio || s.cnpj_cpf_do_socio || s.cpf_socio || s.cpf_representante_legal || s.cpf || s.documento || '',
            documento: s.cpf_cnpj_socio || s.cnpj_cpf_do_socio || s.cpf_socio || s.cpf_representante_legal || s.cpf || s.documento || '',
            cpfRepresentante: s.cpf_representante_legal || ''
          })),
          endereco: {
            cep: data.cep ? maskCEP(data.cep) : '',
            logradouro: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro || ''}`.trim(),
            numero: data.numero || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            municipio: data.municipio || '',
            uf: (data.uf || '').trim().toUpperCase()
          },
          telefone: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : '',
          email: data.email ? String(data.email).toLowerCase() : ''
        };
      }
    }
  } catch (err) {
    console.warn('Tentando próximo provedor de CNPJ (CNPJ.ws)...', err);
  }

  // Provedor 3: CNPJ.ws (Pública)
  try {
    const response = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`);
    if (response.ok) {
      const data = await response.json();
      const est = data.estabelecimento || {};
      if (data.razao_social) {
        const fullPhone = est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : '';
        const rawCode = est.atividade_principal?.subclasse || est.atividade_principal?.id || '';
        const cnaeCode = formatCnaeCode(rawCode);
        const cnaeDesc = est.atividade_principal?.descricao || '';
        const fullCnae = cnaeCode && cnaeDesc ? `${cnaeCode} - ${cnaeDesc}` : (cnaeCode || cnaeDesc);

        return {
          razaoSocial: data.razao_social || '',
          nomeFantasia: est.nome_fantasia || '',
          situacaoCadastral: est.situacao_cadastral || 'Ativa',
          isAtiva: (est.situacao_cadastral || '').toLowerCase() === 'ativa',
          dataAbertura: est.data_inicio_atividade || '',
          cnaeCodigo: cnaeCode,
          cnaeDescricao: cnaeDesc,
          cnae: fullCnae,
          suggestedSegment: mapSegment(cnaeDesc),
          socios: (data.socios || data.qsa || []).map(s => ({
            nome: s.nome || s.nome_socio || s.nome_do_socio || '',
            qualificacao: s.qualificacao_socio?.descricao || s.qualificacao_socio || s.qualificacao_do_socio || s.qualificacao || '',
            cpf_cnpj_socio: s.cpf_cnpj_socio || s.cnpj_cpf_do_socio || s.cpf_socio || s.cpf_representante_legal || s.cpf || s.documento || '',
            documento: s.cpf_cnpj_socio || s.cnpj_cpf_do_socio || s.cpf_socio || s.cpf_representante_legal || s.cpf || s.documento || '',
            cpfRepresentante: s.cpf_representante_legal || ''
          })),
          endereco: {
            cep: est.cep ? maskCEP(est.cep) : '',
            logradouro: `${est.tipo_logradouro || ''} ${est.logradouro || ''}`.trim(),
            numero: est.numero || '',
            complemento: est.complemento || '',
            bairro: est.bairro || '',
            municipio: est.cidade?.nome || '',
            uf: (est.estado?.sigla || '').trim().toUpperCase()
          },
          telefone: fullPhone ? maskPhone(fullPhone) : '',
          email: est.email ? String(est.email).toLowerCase() : ''
        };
      }
    }
  } catch (error) {
    console.warn('Todos os provedores de CNPJ falharam:', error);
  }

  return null;
};

  /**
   * Consulta CEP inteligente com redundância (BrasilAPI v2 com fallback para ViaCEP)
   */
  export const fetchAddressByCEP = async (cep) => {
    const clean = unmask(cep);
    if (clean.length !== 8) return null;

    // 1. Tenta BrasilAPI v2 (alta velocidade e provedores múltiplos)
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
      if (response.ok) {
        const data = await response.json();
        return {
          street: data.street || '',
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: (data.state || data.uf || '').trim().toUpperCase(),
          service: 'brasilapi'
        };
      }
    } catch (err) {}

    // 2. Fallback para ViaCEP
    try {
      const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      if (!response.ok) return null;
      const data = await response.json();
      if (data.erro) return null;

      return {
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: (data.uf || data.state || '').trim().toUpperCase(),
        service: 'viacep'
      };
    } catch (error) {
      return null;
    }
  };
