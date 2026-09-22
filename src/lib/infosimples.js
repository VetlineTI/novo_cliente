import { supabase, isSupabaseConfigured, updateClientData } from './supabase';

const INFOSIMPLES_TOKEN = 
  import.meta.env.VITE_INFOSIMPLES_TOKEN || 
  'KAnHhP59mqSmrLZmflAQvcDcx2g65C68dOtlTYnw';

// Rota com proxy no Vite (localhost) e Vercel (produção) para evitar erros de CORS no navegador
const BASE_URL = '/api-infosimples';

/**
 * Consulta oficial de CNPJ na Receita Federal via Infosimples
 * Retorna dados completos e link/recibo oficial do comprovante
 */
export const consultarReceitaCNPJ = async (cnpj) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido (deve conter 14 dígitos)' };
  }

  try {
    const response = await fetch(`${BASE_URL}/receita-federal/cnpj`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: INFOSIMPLES_TOKEN,
        cnpj: cleanCnpj,
        timeout: 120
      })
    });

    if (!response.ok && response.status !== 400 && response.status !== 422) {
      return {
        success: false,
        error: `Servidor da Receita Federal retornou HTTP ${response.status}: ${response.statusText}`
      };
    }

    const result = await response.json();
    if (result.code === 200 && result.data && result.data.length > 0) {
      const dataItem = result.data[0];
      const receiptUrl = (result.site_receipts && result.site_receipts[0]) || dataItem.site_receipt || null;
      return {
        success: true,
        data: dataItem,
        receiptUrl,
        raw: result
      };
    }

    const errMessage = result.code_message || (result.errors && result.errors[0]) || 'Falha na consulta da Receita Federal';
    return {
      success: false,
      code: result.code,
      error: errMessage,
      raw: result
    };
  } catch (err) {
    return { success: false, error: err.message || 'Erro de conexão na consulta da Receita Federal' };
  }
};

/**
 * Consulta NIRE e dados básicos da empresa na JUCESP (Junta Comercial de SP)
 * (Consulta pública com validação estrita de correspondência de Razão Social)
 */
export const consultarJucespNire = async (cnpj, companyName = '') => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido (deve conter 14 dígitos)' };
  }

  try {
    const payload = {
      token: INFOSIMPLES_TOKEN,
      cnpj: cleanCnpj,
      timeout: 120
    };

    if (companyName && companyName.trim()) {
      payload.nome = companyName.trim();
    }

    const response = await fetch(`${BASE_URL}/junta-comercial/sp/nire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok && response.status !== 400 && response.status !== 422) {
      return {
        success: false,
        error: `Servidor da JUCESP retornou HTTP ${response.status}: ${response.statusText}`
      };
    }

    const result = await response.json();
    if (result.code === 200 && result.data && Array.isArray(result.data) && result.data.length > 0) {
      // Valida se algum registro realmente corresponde à empresa consultada
      let matchedItem = null;
      
      if (companyName && companyName.trim()) {
        const cleanSearchName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        matchedItem = result.data.find(item => {
          if (!item.nome) return false;
          const cleanItemName = item.nome.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanItemName.includes(cleanSearchName) || cleanSearchName.includes(cleanItemName);
        });
      }

      // Se só houver 1 resultado retornado ou se encontrou correspondência exata
      if (!matchedItem && result.data.length === 1 && result.data[0].nire) {
        matchedItem = result.data[0];
      }

      if (matchedItem) {
        const receiptUrl = (result.site_receipts && result.site_receipts[0]) || matchedItem.site_receipt || null;
        return {
          success: true,
          nire: matchedItem.nire || matchedItem.numero_nire || null,
          data: matchedItem,
          receiptUrl,
          raw: result
        };
      }

      // Se a JUCESP retornou a lista genérica sem correspondência
      return {
        success: false,
        code: 404,
        error: 'Empresa não localizada na busca pública da JUCESP. O portal estadual exige login Gov.br para emissão da Ficha Cadastral Oficial.',
        raw: result
      };
    }

    const errMessage = result.code_message || (result.errors && result.errors[0]) || 'Registro não localizado na JUCESP';
    return {
      success: false,
      code: result.code,
      error: errMessage,
      raw: result
    };
  } catch (err) {
    return { success: false, error: err.message || 'Erro de conexão na consulta da JUCESP' };
  }
};

/**
 * Consulta e emissão da Ficha Cadastral Simplificada / Completa da JUCESP
 * (Exige login Gov.br ou Certificado Digital conforme exigência da JUCESP)
 */
export const consultarJucespFichaSimplificada = async (cnpj, options = {}) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido' };
  }

  const loginCpf = options.login_cpf || import.meta.env.VITE_JUCESP_LOGIN_CPF;
  const loginSenha = options.login_senha || import.meta.env.VITE_JUCESP_LOGIN_SENHA;
  const pkcs12Cert = options.pkcs12_cert || import.meta.env.VITE_JUCESP_PKCS12_CERT;
  const pkcs12Pass = options.pkcs12_pass || import.meta.env.VITE_JUCESP_PKCS12_PASS;

  // Se não houver credenciais Gov.br ou certificado, faz a consulta pública do NIRE/Registro
  if (!loginCpf && !pkcs12Cert) {
    return await consultarJucespNire(cleanCnpj);
  }

  try {
    const payload = {
      token: INFOSIMPLES_TOKEN,
      cnpj: cleanCnpj,
      timeout: 180
    };

    if (loginCpf && loginSenha) {
      payload.login_cpf = loginCpf;
      payload.login_senha = loginSenha;
    } else if (pkcs12Cert && pkcs12Pass) {
      payload.pkcs12_cert = pkcs12Cert;
      payload.pkcs12_pass = pkcs12Pass;
    }

    const response = await fetch(`${BASE_URL}/junta-comercial/sp/completa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.code === 200 && result.data && result.data.length > 0) {
      const dataItem = result.data[0];
      const receiptUrl = (result.site_receipts && result.site_receipts[0]) || dataItem.site_receipt || null;
      return {
        success: true,
        isFichaCompleta: true,
        data: dataItem,
        receiptUrl,
        raw: result
      };
    }

    // Se falhar na com login, faz fallback para o registro público
    const fallback = await consultarJucespNire(cleanCnpj);
    return fallback.success ? fallback : {
      success: false,
      code: result.code,
      error: result.code_message || result.errors?.[0] || 'Falha ao emitir ficha simplificada na JUCESP',
      raw: result
    };
  } catch (err) {
    return await consultarJucespNire(cleanCnpj);
  }
};

/**
 * Consulta de Protestos no CENPROT-SP / IEPTB
 */
export const consultarProtestosCenprot = async (cnpj) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido' };
  }

  try {
    const response = await fetch(`${BASE_URL}/cenprot-sp/protestos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: INFOSIMPLES_TOKEN,
        cnpj: cleanCnpj,
        timeout: 120
      })
    });

    if (!response.ok && response.status !== 400 && response.status !== 422) {
      return {
        success: false,
        error: `Servidor do CENPROT retornou HTTP ${response.status}: ${response.statusText}`
      };
    }

    const result = await response.json();
    if (result.code === 200 && result.data) {
      const dataItem = result.data[0] || {};
      const receiptUrl = (result.site_receipts && result.site_receipts[0]) || dataItem.site_receipt || null;
      const totalProtests = dataItem.total_protestos ?? dataItem.quantidade_protestos ?? (dataItem.protestos ? dataItem.protestos.length : 0);
      return {
        success: true,
        totalProtests,
        data: dataItem,
        receiptUrl,
        raw: result
      };
    }

    const errMessage = result.code_message || (result.errors && result.errors[0]) || 'Consulta CENPROT indisponível no momento';
    return {
      success: false,
      code: result.code,
      error: errMessage,
      raw: result
    };
  } catch (err) {
    return { success: false, error: err.message || 'Erro de conexão no CENPROT' };
  }
};

/**
 * Executa a esteira completa de Auditoria / Bureau para um cliente PJ
 * Consulta Receita Federal, JUCESP e Protestos, salva comprovantes no Storage
 * e atualiza o cadastro do cliente no Supabase com validação real de erros
 * @param {Object} client Objeto do cliente
 * @returns {Promise<Object>} Resultado detalhado consolidado
 */
export const executarAuditoriaBureau = async (client) => {
  if (!client || (!client.cpf_cnpj && !client.document_number)) {
    return { 
      success: false, 
      allFailed: true,
      error: 'Dados do cliente inválidos ou CNPJ não informado.',
      failedServices: [{ service: 'Geral', error: 'CNPJ não informado' }] 
    };
  }

  const rawDoc = client.cpf_cnpj || client.document_number;
  const cleanDoc = String(rawDoc).replace(/\D/g, '');
  const clientId = client.id;

  if (cleanDoc.length !== 14) {
    return { 
      success: false, 
      allFailed: true,
      error: 'CNPJ deve conter exatamente 14 dígitos numéricos.',
      failedServices: [{ service: 'Geral', error: 'CNPJ com menos de 14 dígitos' }]
    };
  }

  const results = {
    receita: null,
    jucesp: null,
    cenprot: null,
    consultedAt: new Date().toISOString()
  };

  // 1. Consulta Receita Federal
  try {
    results.receita = await consultarReceitaCNPJ(cleanDoc);
  } catch (e) {
    results.receita = { success: false, error: e.message || 'Erro na consulta da Receita Federal' };
  }

  // 2. Consulta JUCESP
  try {
    const companyName = client.razao_social_nome || client.full_name || results.receita?.data?.razao_social || '';
    results.jucesp = await consultarJucespNire(cleanDoc, companyName);
  } catch (e) {
    results.jucesp = { success: false, error: e.message || 'Erro na consulta da JUCESP' };
  }

  // 3. Consulta CENPROT Protestos
  try {
    results.cenprot = await consultarProtestosCenprot(cleanDoc);
  } catch (e) {
    results.cenprot = { success: false, error: e.message || 'Erro na consulta do CENPROT' };
  }

  // URLs dos comprovantes válidos
  const docReceitaUrl = results.receita?.success ? results.receita.receiptUrl : null;
  const docJucespUrl = results.jucesp?.success ? results.jucesp.receiptUrl : null;
  const docCenprotUrl = results.cenprot?.success ? results.cenprot.receiptUrl : null;

  const successfulServices = [];
  const failedServices = [];

  if (results.receita?.success) {
    successfulServices.push('Receita Federal (Cartão CNPJ)');
  } else {
    failedServices.push({
      service: 'Receita Federal',
      code: results.receita?.code,
      error: results.receita?.error || 'Falha na consulta'
    });
  }

  if (results.jucesp?.success) {
    successfulServices.push('JUCESP (Registro/NIRE)');
  } else {
    failedServices.push({
      service: 'JUCESP',
      code: results.jucesp?.code,
      error: results.jucesp?.error || 'Registro não localizado'
    });
  }

  if (results.cenprot?.success) {
    successfulServices.push('CENPROT (Protestos)');
  } else {
    failedServices.push({
      service: 'CENPROT Protestos',
      code: results.cenprot?.code,
      error: results.cenprot?.error || 'Indisponível no momento'
    });
  }

  const allSuccessful = successfulServices.length === 3;
  const allFailed = successfulServices.length === 0;
  const isPartial = successfulServices.length > 0 && failedServices.length > 0;

  // Se TODOS os serviços falharam
  if (allFailed) {
    const errorDetails = failedServices.map(f => `${f.service}: ${f.error}`).join(' | ');
    return {
      success: false,
      allSuccessful: false,
      isPartial: false,
      allFailed: true,
      error: `Nenhum serviço do Bureau pôde ser consultado: ${errorDetails}`,
      failedServices,
      successfulServices,
      data: results
    };
  }

  // Salva no banco de dados o que tiver sido obtido com sucesso
  let dbSaveSuccess = true;
  let dbSaveError = null;

  if (clientId) {
    try {
      const updatePayload = {
        bureau_consulted_at: results.consultedAt
      };

      if (docReceitaUrl) updatePayload.doc_receita_url = docReceitaUrl;
      if (docJucespUrl) updatePayload.doc_jucesp_url = docJucespUrl;
      if (docCenprotUrl) updatePayload.doc_cenprot_url = docCenprotUrl;
      if (results.jucesp?.success && results.jucesp?.nire) updatePayload.nire_jucesp = results.jucesp.nire;
      if (results.cenprot?.success && results.cenprot?.totalProtests !== undefined) {
        updatePayload.total_protestos = results.cenprot.totalProtests;
      }

      const saveRes = await updateClientData(clientId, updatePayload);
      if (!saveRes?.success) {
        dbSaveSuccess = false;
        dbSaveError = saveRes?.error || 'Erro ao persistir dados do bureau no banco';
      }
    } catch (dbErr) {
      dbSaveSuccess = false;
      dbSaveError = dbErr.message;
      console.warn('Erro ao atualizar dados do bureau:', dbErr);
    }
  }

  return {
    success: dbSaveSuccess,
    allSuccessful: allSuccessful && dbSaveSuccess,
    isPartial: isPartial || !dbSaveSuccess,
    allFailed: false,
    successfulServices,
    failedServices,
    dbSaveSuccess,
    dbSaveError,
    data: results,
    docReceitaUrl,
    docJucespUrl,
    docCenprotUrl
  };
};
