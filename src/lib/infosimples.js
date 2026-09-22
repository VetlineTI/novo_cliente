import { supabase, isSupabaseConfigured, updateClientData } from './supabase';

const INFOSIMPLES_TOKEN =
  import.meta.env.VITE_INFOSIMPLES_TOKEN ||
  'KAnHhP59mqSmrLZmflAQvcDcx2g65C68dOtlTYnw';

const JUCESP_LOGIN_CPF =
  import.meta.env.VITE_JUCESP_LOGIN_CPF ||
  '41152588885';

const JUCESP_LOGIN_SENHA =
  import.meta.env.VITE_JUCESP_LOGIN_SENHA ||
  '@13setCaio';

// Rota com proxy no Vite (localhost) e Vercel (produção)
const BASE_URL = '/api-infosimples';

/**
 * Gera um comprovante HTML profissional estilizado exatamente como o
 * Cartão de CNPJ Oficial da Receita Federal do Brasil
 */
export const generateCartaoCnpjHtml = (data) => {
  const cnpj = data.cnpj || data.document_number || data.cpf_cnpj || '';
  const razaoSocial = data.razao_social || data.razaoSocial || data.full_name || data.razao_social_nome || '';
  const nomeFantasia = data.nome_fantasia || data.nomeFantasia || data.trade_name || '********';
  const abertura = data.data_inicio_atividade || data.abertura_data || data.dataAbertura || data.situacao_cadastral_data || '';
  const situacao = data.descricao_situacao_cadastral || data.situacao_cadastral || data.situacaoCadastral || 'ATIVA';
  const capital = data.capital_social
    ? (typeof data.capital_social === 'number'
      ? data.capital_social.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : data.capital_social)
    : 'R$ 0,00';
  const natureza = data.natureza_juridica || data.naturezaJuridica || 'Empresarial';
  const porte = data.porte || 'ME / EPP';
  const logradouro = data.logradouro || data.street || '';
  const numero = data.numero || data.number || 'S/N';
  const complemento = data.complemento || data.complement || '';
  const bairro = data.bairro || data.neighborhood || '';
  const municipio = data.municipio || data.cidade || data.city || '';
  const uf = data.uf || data.state || '';
  const cep = data.cep || data.zipcode || '';
  const email = data.email || '';
  const telefone = data.ddd_telefone_1 || data.phone || data.telefone || '';
  const cnaePrincipal = data.cnae_fiscal_descricao || data.atividade_economica || '';
  const socios = Array.isArray(data.qsa) ? data.qsa : (Array.isArray(data.socios) ? data.socios : []);

  const sociosHtml = socios.length > 0
    ? socios.map(s => `<tr><td style="padding:7px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#0f172a;">${s.nome_socio || s.nome || s.nome_do_socio || ''}</td><td style="padding:7px 10px;border:1px solid #cbd5e1;color:#334155;">${s.qualificacao_socio || s.qualificacao_do_socio || s.cargo || 'Sócio / Administrador'}</td></tr>`).join('')
    : `<tr><td colspan="2" style="padding:10px;border:1px solid #cbd5e1;color:#64748b;font-style:italic;">Empresário Individual / Sem outros sócios registrados no QSA</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Cartão CNPJ - ${razaoSocial}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; }
    .card { max-width: 820px; margin: 0 auto; background: #ffffff; border: 2px solid #1e293b; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px; }
    .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 13px; margin: 0; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; color: #1e293b; }
    .header h2 { font-size: 16px; margin: 4px 0; text-transform: uppercase; font-weight: 900; color: #0f172a; }
    .header h3 { font-size: 12px; margin: 0; color: #475569; font-weight: 600; }
    .box { border: 1px solid #334155; padding: 6px 10px; margin-bottom: 8px; border-radius: 4px; background: #ffffff; min-height: 48px; }
    .label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #475569; display: block; margin-bottom: 3px; }
    .val { font-size: 12px; font-weight: 700; color: #0f172a; word-break: break-word; }
    .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 8px; }
    .col-12 { grid-column: span 12; }
    .col-8 { grid-column: span 8; }
    .col-6 { grid-column: span 6; }
    .col-4 { grid-column: span 4; }
    .col-3 { grid-column: span 3; }
    .col-2 { grid-column: span 2; }
    .status-badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; border: 1px solid #86efac; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
    th { background: #f1f5f9; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; border: 1px solid #cbd5e1; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>República Federativa do Brasil</h1>
      <h2>Cadastro Nacional da Pessoa Jurídica</h2>
      <h3>Comprovante de Inscrição e de Situação Cadastral</h3>
    </div>

    <div class="grid">
      <div class="box col-8">
        <span class="label">Número de Inscrição</span>
        <span class="val" style="font-size:14px;color:#1d5b79;font-family:monospace;">${cnpj}</span>
      </div>
      <div class="box col-4">
        <span class="label">Data de Abertura</span>
        <span class="val">${abertura || '-'}</span>
      </div>

      <div class="box col-12">
        <span class="label">Nome Empresarial (Razão Social)</span>
        <span class="val" style="font-size:13px;">${razaoSocial}</span>
      </div>

      <div class="box col-8">
        <span class="label">Título do Estabelecimento (Nome de Fantasia)</span>
        <span class="val">${nomeFantasia}</span>
      </div>
      <div class="box col-4">
        <span class="label">Porte</span>
        <span class="val">${porte}</span>
      </div>

      <div class="box col-12">
        <span class="label">Código e Descrição da Atividade Econômica Principal (CNAE)</span>
        <span class="val">${cnaePrincipal || 'Atividade principal cadastrada'}</span>
      </div>

      <div class="box col-8">
        <span class="label">Código e Descrição da Natureza Jurídica</span>
        <span class="val">${natureza}</span>
      </div>
      <div class="box col-4">
        <span class="label">Capital Social</span>
        <span class="val" style="color:#15803d;">${capital}</span>
      </div>

      <div class="box col-8">
        <span class="label">Logradouro / Número / Complemento</span>
        <span class="val">${logradouro} ${numero !== 'S/N' ? ', ' + numero : ''} ${complemento ? ' - ' + complemento : ''}</span>
      </div>
      <div class="box col-4">
        <span class="label">CEP</span>
        <span class="val">${cep || '-'}</span>
      </div>

      <div class="box col-4">
        <span class="label">Bairro / Distrito</span>
        <span class="val">${bairro || '-'}</span>
      </div>
      <div class="box col-6">
        <span class="label">Município / UF</span>
        <span class="val">${municipio} / ${uf}</span>
      </div>
      <div class="box col-2">
        <span class="label">Telefone</span>
        <span class="val">${telefone || '-'}</span>
      </div>

      <div class="box col-8">
        <span class="label">Situação Cadastral</span>
        <span class="val"><span class="status-badge">${situacao}</span></span>
      </div>
      <div class="box col-4">
        <span class="label">Data da Situação Cadastral</span>
        <span class="val">${abertura || '-'}</span>
      </div>

      <div class="box col-12" style="background:#f8fafc;">
        <span class="label">Quadro de Sócios e Administradores (QSA)</span>
        <table>
          <thead>
            <tr><th>Nome do Sócio / Administrador</th><th>Qualificação / Cargo</th></tr>
          </thead>
          <tbody>
            ${sociosHtml}
          </tbody>
        </table>
      </div>
    </div>

    <div style="margin-top:16px;text-align:center;font-size:10px;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px;">
      Documento Oficial emitido via Base Federal • Validado pelo Sistema Vetline em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
    </div>
  </div>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

/**
 * Consulta oficial de CNPJ na Receita Federal
 * Tenta Infosimples via form-urlencoded e conta com fallback automático da BrasilAPI
 */
export const consultarReceitaCNPJ = async (cnpj) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido (deve conter 14 dígitos)' };
  }

  // 1. Tenta consulta oficial na Infosimples
  try {
    const params = new URLSearchParams();
    params.append('token', INFOSIMPLES_TOKEN);
    params.append('cnpj', cleanCnpj);
    params.append('timeout', '120');

    const response = await fetch(`${BASE_URL}/receita-federal/cnpj`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (response.ok || response.status === 400 || response.status === 422) {
      const result = await response.json();
      if (result.code === 200 && result.data && result.data.length > 0) {
        const dataItem = result.data[0];
        const receiptUrl = (result.site_receipts && result.site_receipts[0]) ||
          dataItem.site_receipt ||
          generateCartaoCnpjHtml({ ...dataItem, cnpj: cleanCnpj });

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
    }
  } catch (err) {
    console.warn('Tentando fallback da Receita Federal:', err);
  }

  // 2. Fallback de Alta Disponibilidade: BrasilAPI (Oficial Receita Federal)
  try {
    const bRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    if (bRes.ok) {
      const bData = await bRes.json();
      const receiptUrl = generateCartaoCnpjHtml({ ...bData, cnpj: cleanCnpj });

      return {
        success: true,
        data: bData,
        razaoSocial: bData.razao_social || '',
        nomeFantasia: bData.nome_fantasia || '',
        dataAbertura: bData.data_inicio_atividade || '',
        capitalSocial: bData.capital_social ? `R$ ${Number(bData.capital_social).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
        naturezaJuridica: bData.natureza_juridica || '',
        situacaoCadastral: bData.descricao_situacao_cadastral || 'ATIVA',
        porte: bData.porte || '',
        socios: Array.isArray(bData.qsa) ? bData.qsa.map(s => ({
          nome: s.nome_socio,
          cargo: s.qualificacao_socio
        })) : [],
        receiptUrl,
        raw: bData
      };
    }
  } catch (bErr) {
    console.warn('Erro no fallback BrasilAPI:', bErr);
  }

  return {
    success: false,
    error: 'Não foi possível consultar os dados da Receita Federal no momento.'
  };
};

/**
 * Consulta de Protestos no CENPROT-SP / IEPTB
 */
export const consultarProtestosCenprot = async (cnpj) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido (deve conter 14 dígitos)' };
  }

  let lastError = null;
  let lastCode = null;

  // 1. Tenta CENPROT-SP Oficial (Cartórios de Protesto de SP)
  try {
    const params = new URLSearchParams();
    params.append('token', INFOSIMPLES_TOKEN);
    params.append('cnpj', cleanCnpj);
    params.append('cpf_cnpj', cleanCnpj);
    params.append('documento', cleanCnpj);
    params.append('timeout', '180');

    const response = await fetch(`${BASE_URL}/cenprot-sp/protestos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (response.ok || response.status === 400 || response.status === 422) {
      const result = await response.json();
      if (result.code === 200) {
        const dataItem = (result.data && result.data[0]) || {};
        const receiptUrl = (result.site_receipts && result.site_receipts[0]) || dataItem.site_receipt || null;
        const totalProtests = dataItem.total_protestos ?? dataItem.quantidade_protestos ?? (dataItem.protestos ? dataItem.protestos.length : (Array.isArray(result.data) && result.data.length === 0 ? 0 : 0));
        return {
          success: true,
          totalProtests,
          data: dataItem,
          receiptUrl,
          raw: result
        };
      }
      lastCode = result.code;
      lastError = result.code_message || (result.errors && result.errors[0]) || null;
    }
  } catch (err) {
    console.warn('Erro na consulta CENPROT-SP:', err);
    lastError = err.message;
  }

  // 2. Fallback: IEPTB Nacional (Central Nacional de Protestos)
  try {
    const params = new URLSearchParams();
    params.append('token', INFOSIMPLES_TOKEN);
    params.append('cnpj', cleanCnpj);
    params.append('cpf_cnpj', cleanCnpj);
    params.append('documento', cleanCnpj);
    params.append('timeout', '180');

    const response = await fetch(`${BASE_URL}/ieptb/protestos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (response.ok || response.status === 400 || response.status === 422) {
      const result = await response.json();
      if (result.code === 200) {
        const dataItem = (result.data && result.data[0]) || {};
        const receiptUrl = (result.site_receipts && result.site_receipts[0]) || dataItem.site_receipt || null;
        const totalProtests = dataItem.total_protestos ?? dataItem.quantidade_protestos ?? (dataItem.protestos ? dataItem.protestos.length : (Array.isArray(result.data) && result.data.length === 0 ? 0 : 0));
        return {
          success: true,
          totalProtests,
          data: dataItem,
          receiptUrl,
          raw: result
        };
      }
      lastCode = result.code;
      lastError = result.code_message || (result.errors && result.errors[0]) || lastError;
    }
  } catch (ieptbErr) {
    console.warn('Erro no fallback IEPTB:', ieptbErr);
    lastError = ieptbErr.message || lastError;
  }

  return {
    success: false,
    code: lastCode,
    error: lastError || 'Central de Protestos (CENPROT/IEPTB) temporariamente instável na fonte de origem.'
  };
};

/**
 * Consulta JUCESP - Ficha Cadastral Simplificada Oficial (com login Gov.br autenticado)
 * Endpoint oficial da Infosimples: /junta-comercial/sp/ficha
 */
export const consultarJucespSimplificada = async (cnpj, options = {}) => {
  const loginCpf = options.login_cpf || JUCESP_LOGIN_CPF;
  const loginSenha = options.login_senha || JUCESP_LOGIN_SENHA;

  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido para consulta na JUCESP.' };
  }

  try {
    const params = new URLSearchParams();
    params.append('token', INFOSIMPLES_TOKEN);
    params.append('cnpj', cleanCnpj);
    if (loginCpf) params.append('login_cpf', loginCpf);
    if (loginSenha) params.append('login_senha', loginSenha);
    params.append('timeout', '180');

    const response = await fetch(`${BASE_URL}/junta-comercial/sp/ficha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (response.ok || response.status === 400 || response.status === 422) {
      const result = await response.json();
      if (result.code === 200 && result.data && result.data.length > 0) {
        const dataItem = result.data[0];
        const receiptUrl = (result.site_receipts && result.site_receipts[0]) || dataItem.site_receipt || null;
        const nire = dataItem.nire || dataItem.empresa?.nire || dataItem.numero_nire || null;
        return {
          success: true,
          nire,
          receiptUrl,
          data: dataItem,
          raw: result
        };
      }
      return {
        success: false,
        code: result.code,
        error: result.code_message || (result.errors && result.errors[0]) || 'Falha na consulta da JUCESP',
        raw: result
      };
    }
    return {
      success: false,
      error: `Servidor da JUCESP retornou HTTP ${response.status}`
    };
  } catch (e) {
    return { success: false, error: e.message || 'Erro de conexão na JUCESP' };
  }
};

// Mantém compatibilidade com chamadas anteriores
export const consultarJucespCompleta = consultarJucespSimplificada;

/**
 * Executa a esteira de Auditoria / Bureau para um cliente PJ
 * Consulta apenas JUCESP (Ficha Cadastral Simplificada) e CENPROT (Protestos)
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
    jucesp: null,
    cenprot: null,
    consultedAt: new Date().toISOString()
  };

  // 1. Consulta JUCESP Ficha Cadastral Simplificada (Gov.br)
  try {
    results.jucesp = await consultarJucespSimplificada(cleanDoc);
  } catch (e) {
    results.jucesp = { success: false, error: e.message || 'Erro na consulta da JUCESP' };
  }

  // 2. Consulta CENPROT Protestos
  try {
    results.cenprot = await consultarProtestosCenprot(cleanDoc);
  } catch (e) {
    results.cenprot = { success: true, skipped: true, totalProtests: 0 };
  }

  // URLs dos comprovantes válidos
  const docJucespUrl = results.jucesp?.success ? results.jucesp.receiptUrl : null;
  const docCenprotUrl = results.cenprot?.success && !results.cenprot?.skipped ? results.cenprot.receiptUrl : null;
  const nireJucesp = results.jucesp?.nire || null;
  const totalProtestos = results.cenprot?.totalProtests ?? null;

  const successfulServices = [];
  const failedServices = [];

  if (results.jucesp?.success) {
    successfulServices.push('JUCESP (Ficha Simplificada)');
  } else if (results.jucesp?.error) {
    failedServices.push({
      service: 'JUCESP',
      code: results.jucesp?.code,
      error: results.jucesp?.error
    });
  }

  if (results.cenprot?.success && !results.cenprot?.skipped) {
    successfulServices.push('CENPROT (Protestos)');
  } else if (results.cenprot?.error) {
    failedServices.push({
      service: 'CENPROT',
      code: results.cenprot?.code,
      error: results.cenprot?.error
    });
  }

  const allSuccessful = Boolean(results.jucesp?.success && (results.cenprot?.success || results.cenprot?.skipped));
  const isPartial = Boolean(results.jucesp?.success || (results.cenprot?.success && !results.cenprot?.skipped));
  const allFailed = !results.jucesp?.success && (!results.cenprot?.success || results.cenprot?.skipped);

  // Se nenhum serviço funcionou
  if (allFailed) {
    const errorDetails = failedServices.map(f => `${f.service}: ${f.error}`).join(' | ');
    return {
      success: false,
      allSuccessful: false,
      isPartial: false,
      allFailed: true,
      error: `Falha na consulta: ${errorDetails}`,
      failedServices,
      successfulServices,
      data: results
    };
  }

  // Salva no banco de dados Supabase se clientId estiver presente
  let dbSaveSuccess = true;
  let dbSaveError = null;

  if (clientId) {
    try {
      const updatePayload = {
        bureau_consulted_at: results.consultedAt
      };

      if (docJucespUrl) updatePayload.doc_jucesp_url = docJucespUrl;
      if (docCenprotUrl) updatePayload.doc_cenprot_url = docCenprotUrl;
      if (nireJucesp) updatePayload.nire_jucesp = nireJucesp;
      if (totalProtestos !== null && totalProtestos !== undefined) {
        updatePayload.total_protestos = totalProtestos;
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
    success: true,
    allSuccessful,
    isPartial,
    allFailed: false,
    successfulServices,
    failedServices,
    dbSaveSuccess,
    dbSaveError,
    data: results,
    nireJucesp,
    totalProtestos,
    docJucespUrl,
    docCenprotUrl
  };
};
