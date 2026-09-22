import { supabase, isSupabaseConfigured } from './supabase';

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
    return { success: false, error: 'CNPJ inválido' };
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

    return {
      success: false,
      error: result.code_message || result.errors?.[0] || 'Falha na consulta da Receita Federal',
      raw: result
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Consulta NIRE e dados básicos da empresa na JUCESP (Junta Comercial de SP)
 * (Consulta pública - não exige login Gov.br)
 */
export const consultarJucespNire = async (cnpj) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido' };
  }

  try {
    const response = await fetch(`${BASE_URL}/junta-comercial/sp/nire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: INFOSIMPLES_TOKEN,
        cnpj: cleanCnpj,
        timeout: 120
      })
    });

    const result = await response.json();
    if (result.code === 200 && result.data && result.data.length > 0) {
      const dataItem = result.data[0];
      const receiptUrl = (result.site_receipts && result.site_receipts[0]) || dataItem.site_receipt || null;
      return {
        success: true,
        nire: dataItem.nire || dataItem.numero_nire || null,
        data: dataItem,
        receiptUrl,
        raw: result
      };
    }

    return {
      success: false,
      error: result.code_message || result.errors?.[0] || 'Registro não localizado na JUCESP',
      raw: result
    };
  } catch (err) {
    return { success: false, error: err.message };
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

    return {
      success: false,
      error: result.code_message || result.errors?.[0] || 'Consulta CENPROT temporariamente indisponível',
      raw: result
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Executa a esteira completa de Auditoria / Bureau para um cliente PJ
 * Consulta Receita Federal, JUCESP e Protestos, salva comprovantes no Storage
 * e atualiza o cadastro do cliente no Supabase
 * @param {Object} client Objeto do cliente
 * @returns {Promise<Object>} Resultado consolidado
 */
export const executarAuditoriaBureau = async (client) => {
  if (!client || !client.cpf_cnpj && !client.document_number) {
    return { success: false, error: 'Dados do cliente inválidos' };
  }

  const rawDoc = client.cpf_cnpj || client.document_number;
  const cleanDoc = String(rawDoc).replace(/\D/g, '');
  const clientId = client.id;

  const results = {
    receita: null,
    jucesp: null,
    cenprot: null,
    consultedAt: new Date().toISOString()
  };

  // 1. Consulta Receita Federal
  try {
    const resReceita = await consultarReceitaCNPJ(cleanDoc);
    results.receita = resReceita;
  } catch (e) {
    results.receita = { success: false, error: e.message };
  }

  // 2. Consulta JUCESP
  try {
    const resJucesp = await consultarJucespNire(cleanDoc);
    results.jucesp = resJucesp;
  } catch (e) {
    results.jucesp = { success: false, error: e.message };
  }

  // 3. Consulta CENPROT Protestos
  try {
    const resCenprot = await consultarProtestosCenprot(cleanDoc);
    results.cenprot = resCenprot;
  } catch (e) {
    results.cenprot = { success: false, error: e.message };
  }

  // Prepara as URLs dos comprovantes
  const docReceitaUrl = results.receita?.receiptUrl || null;
  const docJucespUrl = results.jucesp?.receiptUrl || null;
  const docCenprotUrl = results.cenprot?.receiptUrl || null;

  // Atualiza no Supabase se houver clientId e Supabase configurado
  if (isSupabaseConfigured && supabase && clientId) {
    try {
      const updatePayload = {
        bureau_consulted_at: results.consultedAt
      };

      if (docReceitaUrl) updatePayload.doc_receita_url = docReceitaUrl;
      if (docJucespUrl) updatePayload.doc_jucesp_url = docJucespUrl;
      if (docCenprotUrl) updatePayload.doc_cenprot_url = docCenprotUrl;
      if (results.jucesp?.nire) updatePayload.nire_jucesp = results.jucesp.nire;
      if (results.cenprot?.totalProtests !== undefined) {
        updatePayload.total_protestos = results.cenprot.totalProtests;
      }

      await supabase
        .schema('novo_cliente')
        .from('data_new_client')
        .update(updatePayload)
        .eq('id', clientId);
    } catch (dbErr) {
      console.warn('Erro ao atualizar dados do bureau no Supabase:', dbErr);
    }
  }

  return {
    success: true,
    data: results,
    docReceitaUrl,
    docJucespUrl,
    docCenprotUrl
  };
};
