import { supabase, isSupabaseConfigured, updateClientData } from './supabase';

const INFOSIMPLES_TOKEN = 
  import.meta.env.VITE_INFOSIMPLES_TOKEN || 
  'KAnHhP59mqSmrLZmflAQvcDcx2g65C68dOtlTYnw';

// Rota com proxy no Vite (localhost) e Vercel (produção) para evitar erros de CORS no navegador
const BASE_URL = '/api-infosimples';

/**
 * Consulta oficial de CNPJ na Receita Federal via Infosimples
 * Retorna dados completos (Sócios/QSA, Capital Social, Data de Abertura, CNAEs) e o Cartão CNPJ Oficial
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
        razaoSocial: dataItem.razao_social || '',
        nomeFantasia: dataItem.nome_fantasia || '',
        dataAbertura: dataItem.abertura_data || dataItem.normalizado_abertura_data || dataItem.situacao_cadastral_data || '',
        capitalSocial: dataItem.capital_social || '',
        naturezaJuridica: dataItem.natureza_juridica || '',
        situacaoCadastral: dataItem.situacao_cadastral || 'ATIVA',
        porte: dataItem.porte || '',
        socios: Array.isArray(dataItem.qsa) ? dataItem.qsa : [],
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
 * Consulta de Protestos no CENPROT-SP / IEPTB
 */
export const consultarProtestosCenprot = async (cnpj) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido (deve conter 14 dígitos)' };
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

    const errMessage = result.code_message || (result.errors && result.errors[0]) || 'Consulta CENPROT temporariamente indisponível';
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
 * Consulta JUCESP (Opcional - Ativada apenas se houver credenciais Gov.br configuradas)
 */
export const consultarJucespOpcional = async (cnpj, options = {}) => {
  const loginCpf = options.login_cpf || import.meta.env.VITE_JUCESP_LOGIN_CPF;
  const loginSenha = options.login_senha || import.meta.env.VITE_JUCESP_LOGIN_SENHA;

  if (!loginCpf || !loginSenha) {
    return { success: false, skipped: true, error: 'JUCESP desativada (utilizando Receita Federal como fonte oficial).' };
  }

  try {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const response = await fetch(`${BASE_URL}/junta-comercial/sp/completa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: INFOSIMPLES_TOKEN,
        cnpj: cleanCnpj,
        login_cpf: loginCpf,
        login_senha: loginSenha,
        timeout: 180
      })
    });

    const result = await response.json();
    if (result.code === 200 && result.data && result.data.length > 0) {
      const dataItem = result.data[0];
      const receiptUrl = (result.site_receipts && result.site_receipts[0]) || dataItem.site_receipt || null;
      return {
        success: true,
        nire: dataItem.nire || dataItem.numero_nire || null,
        receiptUrl,
        data: dataItem
      };
    }
    return { success: false, error: result.code_message || 'Falha na emissão JUCESP Gov.br' };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

/**
 * Executa a esteira principal de Auditoria / Bureau para um cliente PJ
 * Utiliza a Receita Federal (100% pública: Sócios, Capital, Abertura e Cartão CNPJ) e CENPROT (Protestos)
 * @param {Object} client Objeto do cliente
 * @returns {Promise<Object>} Resultado consolidado
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
    cenprot: null,
    jucesp: null,
    consultedAt: new Date().toISOString()
  };

  // 1. Consulta Principal: Receita Federal (Cartão CNPJ, Sócios/QSA, Capital Social, Data Abertura)
  try {
    results.receita = await consultarReceitaCNPJ(cleanDoc);
  } catch (e) {
    results.receita = { success: false, error: e.message || 'Erro na consulta da Receita Federal' };
  }

  // 2. Consulta Secundária: CENPROT Protestos
  try {
    results.cenprot = await consultarProtestosCenprot(cleanDoc);
  } catch (e) {
    results.cenprot = { success: false, error: e.message || 'Erro na consulta do CENPROT' };
  }

  // 3. JUCESP (apenas se credenciais Gov.br estiverem disponíveis)
  try {
    results.jucesp = await consultarJucespOpcional(cleanDoc);
  } catch (e) {
    results.jucesp = { success: false, skipped: true };
  }

  // URLs dos comprovantes válidos
  const docReceitaUrl = results.receita?.success ? results.receita.receiptUrl : null;
  const docCenprotUrl = results.cenprot?.success ? results.cenprot.receiptUrl : null;
  const docJucespUrl = results.jucesp?.success ? results.jucesp.receiptUrl : null;

  const successfulServices = [];
  const failedServices = [];

  if (results.receita?.success) {
    successfulServices.push('Receita Federal (Cartão CNPJ, Sócios e Capital)');
  } else {
    failedServices.push({
      service: 'Receita Federal',
      code: results.receita?.code,
      error: results.receita?.error || 'Falha na consulta'
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

  const allSuccessful = results.receita?.success && results.cenprot?.success;
  const allFailed = successfulServices.length === 0;
  const isPartial = results.receita?.success && !results.cenprot?.success;

  // Se a Receita Federal falhar completamente
  if (allFailed) {
    const errorDetails = failedServices.map(f => `${f.service}: ${f.error}`).join(' | ');
    return {
      success: false,
      allSuccessful: false,
      isPartial: false,
      allFailed: true,
      error: `Falha na consulta do Bureau: ${errorDetails}`,
      failedServices,
      successfulServices,
      data: results
    };
  }

  // Salva no banco de dados
  let dbSaveSuccess = true;
  let dbSaveError = null;

  if (clientId) {
    try {
      const updatePayload = {
        bureau_consulted_at: results.consultedAt
      };

      if (docReceitaUrl) updatePayload.doc_receita_url = docReceitaUrl;
      if (docCenprotUrl) updatePayload.doc_cenprot_url = docCenprotUrl;
      if (docJucespUrl) updatePayload.doc_jucesp_url = docJucespUrl;
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
    receitaDetails: results.receita?.success ? {
      razaoSocial: results.receita.razaoSocial,
      nomeFantasia: results.receita.nomeFantasia,
      dataAbertura: results.receita.dataAbertura,
      capitalSocial: results.receita.capitalSocial,
      naturezaJuridica: results.receita.naturezaJuridica,
      situacaoCadastral: results.receita.situacaoCadastral,
      porte: results.receita.porte,
      socios: results.receita.socios
    } : null,
    docReceitaUrl,
    docCenprotUrl,
    docJucespUrl
  };
};
