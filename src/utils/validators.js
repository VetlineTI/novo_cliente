import { unmask, maskPhone } from './masks';

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

/**
 * Consulta de CNPJ na BrasilAPI (Dados Oficiais da Receita Federal)
 * @param {string} cnpj 
 * @returns {Promise<Object|null>} Dados completos da empresa ou erro
 */
export const fetchCNPJDataFromBrasilAPI = async (cnpj) => {
  const clean = unmask(cnpj);
  if (clean.length !== 14 || !isValidCNPJ(clean)) return null;

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!response.ok) return null;
    const data = await response.json();

    // Mapeamento inteligente de segmento baseado na atividade econômica principal (CNAE)
    const cnaeDesc = (data.cnae_fiscal_descricao || '').toLowerCase();
    let suggestedSegment = '';

    if (cnaeDesc.includes('veterin')) {
      suggestedSegment = 'Clinica Veterinaria';
    } else if (cnaeDesc.includes('animais') || cnaeDesc.includes('pet') || cnaeDesc.includes('higiene')) {
      suggestedSegment = 'Pet Shop';
    } else if (cnaeDesc.includes('agropecu') || cnaeDesc.includes('racao') || cnaeDesc.includes('sementes')) {
      suggestedSegment = 'Agropecuaria';
    } else if (cnaeDesc.includes('farmacia') || cnaeDesc.includes('medicamento')) {
      suggestedSegment = 'Farmacia Veterinaria';
    } else if (cnaeDesc.includes('distribui') || cnaeDesc.includes('atacad')) {
      suggestedSegment = 'Distribuidora / Revenda';
    }

    return {
      razaoSocial: data.razao_social || '',
      nomeFantasia: data.nome_fantasia || '',
      situacaoCadastral: data.descricao_situacao_cadastral || 'ATIVA',
      isAtiva: (data.descricao_situacao_cadastral || '').toUpperCase() === 'ATIVA',
      dataAbertura: data.data_inicio_atividade || '',
      cnaeDescricao: data.cnae_fiscal_descricao || '',
      suggestedSegment,
      // Quadro de Sócios (QSA)
      socios: (data.qsa || []).map(s => ({
        nome: s.nome_socio || '',
        qualificacao: s.qualificacao_socio || '',
        cpfRepresentante: s.cpf_representante_legal || ''
      })),
      // Endereço oficial registrado
      endereco: {
        cep: data.cep || '',
        logradouro: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro || ''}`.trim(),
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        municipio: data.municipio || '',
        uf: data.uf || ''
      },
      telefone: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : '',
      email: data.email ? String(data.email).toLowerCase() : ''
    };
  } catch (error) {
    console.warn('Erro ao consultar BrasilAPI para CNPJ:', error);
    return null;
  }
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
        state: data.state || '',
        service: 'brasilapi'
      };
    }
  } catch (err) {
    console.warn('Fallback para ViaCEP...');
  }

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
      state: data.uf || '',
      service: 'viacep'
    };
  } catch (error) {
    console.warn('Erro ao consultar CEP:', error);
    return null;
  }
};
