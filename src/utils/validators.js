import { unmask, maskPhone, maskCEP } from './masks';
import { consultarDirectDataReceitaPJParticipacaoSocietaria } from '../lib/directd';

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
 * Consulta de CNPJ com redundância multi-provedor (Direct Data Oficial, Minha Receita, BrasilAPI e CNPJ.ws)
 * Evita falhas por CORS / Rate Limit 429 e garante preenchimento automático contínuo
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

  // Provedor 0: Direct Data Oficial (Sem bloqueio de 3 req/min, dados completos do QSA e Comprovante)
  try {
    const directRes = await consultarDirectDataReceitaPJParticipacaoSocietaria(clean);
    if (directRes && directRes.success && (directRes.razaoSocial || directRes.data)) {
      const d = directRes.data || {};
      return {
        razaoSocial: directRes.razaoSocial || d.nomeEmpresarial || d.razaoSocial || '',
        nomeFantasia: directRes.nomeFantasia || d.nomeFantasia || '',
        situacaoCadastral: directRes.situacaoCadastral || d.situacaoCadastral || 'ATIVA',
        isAtiva: (directRes.situacaoCadastral || d.situacaoCadastral || '').toUpperCase().includes('ATIVA'),
        dataAbertura: directRes.dataAbertura || d.dataAbertura || d.dataFundacao || '',
        cnaeDescricao: d.atividadeEconomicaPrincipal || d.cnaeDescricao || '',
        suggestedSegment: mapSegment(d.atividadeEconomicaPrincipal || d.cnaeDescricao),
        socios: (directRes.socios || []).map(s => ({
          nome: s.nome || s.nomeEntidade || '',
          qualificacao: s.qualificacao || 'Sócio',
          cpf_cnpj_socio: s.documento || '',
          documento: s.documento || '',
          cpfRepresentante: ''
        })),
        endereco: {
          cep: d.cep ? maskCEP(d.cep) : '',
          logradouro: `${d.descricaoTipoLogradouro || ''} ${d.logradouro || ''}`.trim(),
          numero: d.numero || '',
          complemento: d.complemento || '',
          bairro: d.bairroDistrito || d.bairro || '',
          municipio: d.municipio || '',
          uf: (d.uf || '').trim().toUpperCase()
        },
        telefone: d.telefone ? maskPhone(d.telefone) : '',
        email: d.enderecoEletronico ? String(d.enderecoEletronico).toLowerCase() : '',
        receiptUrl: directRes.receiptUrl || ''
      };
    }
  } catch (err) {
    console.warn('Tentando próximo provedor de CNPJ (Minha Receita)...', err);
  }

  // Provedor 1: Minha Receita (Base oficial aberta, sem bloqueio de CORS / 429)
  try {
    const response = await fetch(`https://minhareceita.org/${clean}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.razao_social) {
        return {
          razaoSocial: data.razao_social || '',
          nomeFantasia: data.nome_fantasia || '',
          situacaoCadastral: data.descricao_situacao_cadastral || 'ATIVA',
          isAtiva: (data.descricao_situacao_cadastral || '').toUpperCase() === 'ATIVA' || data.situacao_cadastral === 2,
          dataAbertura: data.data_inicio_atividade || '',
          cnaeDescricao: data.cnae_fiscal_descricao || '',
          suggestedSegment: mapSegment(data.cnae_fiscal_descricao),
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
        return {
          razaoSocial: data.razao_social || '',
          nomeFantasia: data.nome_fantasia || '',
          situacaoCadastral: data.descricao_situacao_cadastral || 'ATIVA',
          isAtiva: (data.descricao_situacao_cadastral || '').toUpperCase() === 'ATIVA',
          dataAbertura: data.data_inicio_atividade || '',
          cnaeDescricao: data.cnae_fiscal_descricao || '',
          suggestedSegment: mapSegment(data.cnae_fiscal_descricao),
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
        return {
          razaoSocial: data.razao_social || '',
          nomeFantasia: est.nome_fantasia || '',
          situacaoCadastral: est.situacao_cadastral || 'Ativa',
          isAtiva: (est.situacao_cadastral || '').toLowerCase() === 'ativa',
          dataAbertura: est.data_inicio_atividade || '',
          cnaeDescricao: est.atividade_principal?.descricao || '',
          suggestedSegment: mapSegment(est.atividade_principal?.descricao),
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
