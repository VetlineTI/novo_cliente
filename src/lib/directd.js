// Integração com a API Direct Data (DirectD)
// Endpoints Oficiais: 
// 1. Cadastro PJ Plus: https://apiv3.directd.com.br/api/CadastroPessoaJuridicaPlus
// 2. Protestos Online (IEPTB / CENPROT Nacional): https://apiv3.directd.com.br/api/ProtestosOnline

const DIRECTD_TOKEN =
  import.meta.env.VITE_DIRECTD_TOKEN ||
  '12DC14EA-112C-426C-9EC9-05A1280D23D1';

const BASE_URL = '/api-directd';

/**
 * Gera um comprovante HTML estilizado com os dados cadastrais da Direct Data
 * @param {Object} retorno Dados da empresa
 * @param {Object} metaDados Metadados da consulta
 * @returns {string} Data URI com HTML formatado
 */
export const generateDirectDReceiptHtml = (retorno = {}, metaDados = {}) => {
  const cnpj = retorno.cnpj || '';
  const razaoSocial = retorno.razaoSocial || '';
  const nomeFantasia = retorno.nomeFantasia || '********';
  const dataFundacao = retorno.dataFundacao || '';
  const situacao = retorno.situacaoCadastral || 'ATIVA';
  const cnaePrincipal = retorno.cnaeDescricao ? `${retorno.cnaeCodigo || ''} - ${retorno.cnaeDescricao}` : '';
  const natureza = retorno.naturezaJuridicaDescricao || retorno.naturezaJuridicaTipo || '';
  const porte = retorno.porte || '';
  const faturamento = retorno.faturamentoPresumido || retorno.faixaFaturamento || '';
  const tributacao = retorno.tributacao || retorno.opcaoSimples || '';
  
  const end = (retorno.enderecos && retorno.enderecos[0]) || {};
  const enderecoFormatado = end.logradouro ? `${end.logradouro}, ${end.numero || 'S/N'}${end.complemento ? ' - ' + end.complemento : ''} - ${end.bairro || ''}, ${end.cidade || ''}/${end.uf || ''} - CEP: ${end.cep || ''}` : '-';

  const tel = (retorno.telefones && retorno.telefones[0]) || {};
  const email = (retorno.emails && retorno.emails[0]) || {};

  const socios = Array.isArray(retorno.socios) ? retorno.socios : [];
  const sociosHtml = socios.length > 0
    ? socios.map(s => `<tr><td style="padding:7px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#0f172a;">${s.nome || ''}</td><td style="padding:7px 10px;border:1px solid #cbd5e1;color:#334155;">${s.cargo || 'Sócio / Administrador'}</td><td style="padding:7px 10px;border:1px solid #cbd5e1;color:#64748b;">${s.dataEntrada || '-'}</td></tr>`).join('')
    : `<tr><td colspan="3" style="padding:10px;border:1px solid #cbd5e1;color:#64748b;font-style:italic;">Sem outros sócios registrados no QSA</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante Cadastral PJ - Direct Data - ${razaoSocial}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; }
    .card { max-width: 820px; margin: 0 auto; background: #ffffff; border: 2px solid #0f766e; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px; }
    .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 15px; font-weight: bold; color: #0f766e; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 8px; }
    .box { border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 4px; background: #ffffff; }
    .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 2px; }
    .val { font-size: 11px; font-weight: 600; color: #0f172a; }
    .col-12 { grid-column: span 12; }
    .col-8 { grid-column: span 8; }
    .col-6 { grid-column: span 6; }
    .col-4 { grid-column: span 4; }
    .col-3 { grid-column: span 3; }
    .badge-status { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: bold; display: inline-block; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 10px; text-align: left; color: #475569; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Comprovante de Cadastro de Pessoa Jurídica (Direct Data Plus)</div>
      <div class="subtitle">Base Integrada de Dados Oficiais e Junta Comercial • Consulta UID: ${metaDados.consultaUid || '-'}</div>
    </div>

    <div class="grid">
      <div class="box col-4">
        <span class="label">Número de Inscrição (CNPJ)</span>
        <span class="val">${cnpj}</span>
      </div>
      <div class="box col-4">
        <span class="label">Data de Fundação / Abertura</span>
        <span class="val">${dataFundacao || '-'}</span>
      </div>
      <div class="box col-4">
        <span class="label">Situação Cadastral</span>
        <span class="val badge-status">${situacao}</span>
      </div>

      <div class="box col-12">
        <span class="label">Nome Empresarial (Razão Social)</span>
        <span class="val" style="font-size: 13px; color: #0f766e;">${razaoSocial}</span>
      </div>

      <div class="box col-8">
        <span class="label">Título do Estabelecimento (Nome Fantasia)</span>
        <span class="val">${nomeFantasia}</span>
      </div>
      <div class="box col-4">
        <span class="label">Porte / Regime</span>
        <span class="val">${porte || '-'} ${tributacao ? '(' + tributacao + ')' : ''}</span>
      </div>

      <div class="box col-12">
        <span class="label">Atividade Econômica Principal (CNAE)</span>
        <span class="val">${cnaePrincipal || '-'}</span>
      </div>

      <div class="box col-8">
        <span class="label">Natureza Jurídica</span>
        <span class="val">${natureza || '-'}</span>
      </div>
      <div class="box col-4">
        <span class="label">Faturamento Presumido</span>
        <span class="val">${faturamento || '-'}</span>
      </div>

      <div class="box col-12">
        <span class="label">Endereço Cadastral</span>
        <span class="val">${enderecoFormatado}</span>
      </div>

      <div class="box col-6">
        <span class="label">Telefone de Contato</span>
        <span class="val">${tel.telefoneComDDD || '-'}</span>
      </div>
      <div class="box col-6">
        <span class="label">E-mail de Contato</span>
        <span class="val">${email.enderecoEmail || '-'}</span>
      </div>

      <div class="box col-12" style="background:#f8fafc;">
        <span class="label">Quadro de Sócios e Administradores (QSA)</span>
        <table>
          <thead>
            <tr><th>Nome do Sócio / Administrador</th><th>Qualificação / Cargo</th><th>Data de Entrada</th></tr>
          </thead>
          <tbody>
            ${sociosHtml}
          </tbody>
        </table>
      </div>
    </div>

    <div style="margin-top:16px;text-align:center;font-size:10px;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px;">
      Documento gerado via API Direct Data • Validação Vetline em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
    </div>
  </div>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

/**
 * Gera um comprovante / certidão digital estilizado da Consulta de Protestos (IEPTB / CENPROT)
 * @param {Object} retorno Dados da consulta de protesto
 * @param {Object} metaDados Metadados da consulta
 * @param {string} documento Documento consultado
 * @returns {string} Data URI com HTML formatado
 */
export const generateProtestosDirectDHtml = (retorno = {}, metaDados = {}, documento = '') => {
  const doc = retorno.documentoConsultado || documento || '';
  const totalProtestos = retorno.numeroTotalProtestos ?? 0;
  const constamProtestos = retorno.constamProtestos ?? (totalProtestos > 0);
  const valorTotal = retorno.valorTotalProtestos || 'R$ 0,00';
  const observacoes = retorno.observacoes || (constamProtestos ? 'Constam protestos registrados' : 'Não constam protestos');
  const protestosList = Array.isArray(retorno.protestos) ? retorno.protestos : [];

  let cartoriosRows = '';
  if (protestosList.length > 0) {
    protestosList.forEach(p => {
      const uf = p.estado || '-';
      (p.cartorios || []).forEach(c => {
        cartoriosRows += `<tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#0f172a;">${uf}</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;color:#1e293b;">${c.cidade || '-'}</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;font-weight:bold;color:#b91c1c;">${c.numeroProtestos || 0}</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:right;font-weight:bold;color:#0f172a;">${c.valorTotalProtestosCartorio || 'R$ 0,00'}</td>
        </tr>`;
      });
    });
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Certidão de Protestos - IEPTB / CENPROT - ${doc}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; }
    .card { max-width: 820px; margin: 0 auto; background: #ffffff; border: 2px solid #0f172a; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 15px; font-weight: bold; color: #0f172a; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 4px; }
    .status-box { padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0; }
    .status-ok { background: #dcfce7; border: 2px solid #16a34a; color: #166534; }
    .status-warning { background: #fee2e2; border: 2px solid #dc2626; color: #991b1b; }
    .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 8px; margin-top: 12px; }
    .box { border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 4px; background: #ffffff; }
    .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 2px; }
    .val { font-size: 12px; font-weight: 600; color: #0f172a; }
    .col-12 { grid-column: span 12; }
    .col-6 { grid-column: span 6; }
    .col-4 { grid-column: span 4; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f1f5f9; padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 10px; text-align: left; color: #475569; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Central Nacional de Serviços dos Cartórios de Protesto (IEPTB / CENPROT)</div>
      <div class="subtitle">Consulta Unificada de Títulos Protestados em Todo o Território Nacional • UID: ${metaDados.consultaUid || '-'}</div>
    </div>

    <div class="grid">
      <div class="box col-6">
        <span class="label">Documento Consultado</span>
        <span class="val" style="font-size: 13px;">${doc}</span>
      </div>
      <div class="box col-6">
        <span class="label">Data / Hora da Consulta</span>
        <span class="val">${metaDados.data || new Date().toLocaleString('pt-BR')}</span>
      </div>
    </div>

    <div class="status-box ${constamProtestos ? 'status-warning' : 'status-ok'}">
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">
        ${constamProtestos ? `⚠ CONSTAM ${totalProtestos} PROTESTO(S) ATIVO(S)` : '✓ NADA CONSTA (0 PROTESTOS)'}
      </div>
      <div style="font-size: 12px;">
        ${constamProtestos ? `Valor Total de Títulos Protestados: ${valorTotal}` : 'Não foram localizados registros de protestos ativos para este documento nos cartórios consultados.'}
      </div>
    </div>

    <div class="grid">
      <div class="box col-4">
        <span class="label">Total de Protestos</span>
        <span class="val" style="color: ${constamProtestos ? '#dc2626' : '#16a34a'};">${totalProtestos}</span>
      </div>
      <div class="box col-4">
        <span class="label">Valor Total</span>
        <span class="val">${valorTotal}</span>
      </div>
      <div class="box col-4">
        <span class="label">Situação</span>
        <span class="val">${observacoes}</span>
      </div>
    </div>

    ${cartoriosRows ? `
      <div style="margin-top: 16px;">
        <span class="label" style="font-size: 11px; margin-bottom: 6px;">Detalhamento por Estado e Cartório:</span>
        <table>
          <thead>
            <tr>
              <th>UF</th>
              <th>Cidade / Comarca</th>
              <th style="text-align: center;">Qtd Protestos</th>
              <th style="text-align: right;">Valor no Cartório</th>
            </tr>
          </thead>
          <tbody>
            ${cartoriosRows}
          </tbody>
        </table>
      </div>
    ` : ''}

    <div style="margin-top:20px;text-align:center;font-size:10px;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px;">
      Consulta oficial processada via Direct Data / Base IEPTB Nacional • Validação do Sistema Vetline em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
    </div>
  </div>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

/**
 * Consulta de Pessoa Jurídica na Direct Data (CadastroPessoaJuridicaPlus)
 * @param {string} cnpj CNPJ para consulta
 * @returns {Promise<Object>} Resultado padronizado
 */
export const consultarDirectDataPJ = async (cnpj) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido (deve conter 14 dígitos)' };
  }

  try {
    const params = new URLSearchParams();
    params.append('CNPJ', cleanCnpj);
    params.append('TOKEN', DIRECTD_TOKEN);
    params.append('gerarComprovante', 'true');

    const response = await fetch(`${BASE_URL}/CadastroPessoaJuridicaPlus?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Vetline-App/1.0'
      }
    });

    const result = await response.json();
    const meta = result.metaDados || {};
    const retorno = result.retorno || {};

    if (response.ok && retorno && (retorno.cnpj || retorno.razaoSocial)) {
      const receiptUrl = meta.urlComprovante || generateDirectDReceiptHtml(retorno, meta);

      return {
        success: true,
        data: retorno,
        metaDados: meta,
        razaoSocial: retorno.razaoSocial || '',
        nomeFantasia: retorno.nomeFantasia || '',
        dataAbertura: retorno.dataFundacao || '',
        situacaoCadastral: retorno.situacaoCadastral || 'ATIVA',
        porte: retorno.porte || '',
        naturezaJuridica: retorno.naturezaJuridicaDescricao || '',
        socios: Array.isArray(retorno.socios) ? retorno.socios : [],
        receiptUrl,
        raw: result
      };
    }

    return {
      success: false,
      code: meta.resultadoId || response.status,
      error: meta.mensagem || meta.resultado || 'Falha na consulta Direct Data',
      raw: result
    };
  } catch (err) {
    return {
      success: false,
      error: `Erro ao conectar com Direct Data: ${err.message || 'Erro inesperado'}`
    };
  }
};

/**
 * Gera um comprovante HTML estilizado com os dados da Receita Federal e Participação Societária (QSA)
 * @param {Object} retorno Dados da consulta
 * @param {Object} metaDados Metadados da consulta
 * @returns {string} Data URI com HTML formatado
 */
export const generateReceitaPJParticipacaoSocietariaHtml = (retorno = {}, metaDados = {}) => {
  const cnpj = retorno.numeroInscricao || retorno.cnpj || '';
  const razaoSocial = retorno.nomeEmpresarial || retorno.razaoSocial || '';
  const nomeFantasia = retorno.nomeFantasia || '-';
  const dataAbertura = retorno.dataAbertura || retorno.dataFundacao || '';
  const situacao = retorno.situacaoCadastral || 'Ativa';
  const dataSituacao = retorno.dataSituacaoCadastral || '';
  const cnaePrincipal = retorno.atividadeEconomicaPrincipal || '';
  const natureza = retorno.naturezaJuridica || '';
  const porte = retorno.porte || '';
  const capitalSocial = retorno.capitalSocialQSA || '-';
  const telefone = retorno.telefone || '-';
  const email = retorno.enderecoEletronico || '-';

  const enderecoFormatado = retorno.logradouro
    ? `${retorno.logradouro}, ${retorno.numero || 'S/N'}${retorno.complemento ? ' - ' + retorno.complemento : ''} - ${retorno.bairroDistrito || retorno.bairro || ''}, ${retorno.municipio || ''}/${retorno.uf || ''} - CEP: ${retorno.cep || ''}`
    : '-';

  const socios = Array.isArray(retorno.socios) ? retorno.socios : [];
  const sociosRows = socios.length > 0
    ? socios.map(s => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#0f172a;">${s.nomeEntidade || s.nome || '-'}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;color:#334155;">${s.qualificacao || 'Sócio'}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;color:#0f766e;font-family:monospace;">${s.documento || '-'}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;font-weight:600;color:#0369a1;">${s.percentualParticipacao ? s.percentualParticipacao + '%' : '-'}</td>
        <td style="padding:8px 10px;border:1px solid #cbd5e1;color:#64748b;text-align:center;">${s.dataEntradaSociedade || s.dataEntrada || '-'}</td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="padding:10px;border:1px solid #cbd5e1;color:#64748b;font-style:italic;text-align:center;">Nenhum sócio informado no QSA</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Receita Federal - Quadro Societário - ${razaoSocial || cnpj}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; }
    .card { max-width: 860px; margin: 0 auto; background: #ffffff; border: 2px solid #0f766e; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px; }
    .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 15px; font-weight: bold; color: #0f766e; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 8px; }
    .box { border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 4px; background: #ffffff; }
    .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 2px; }
    .val { font-size: 11px; font-weight: 600; color: #0f172a; }
    .col-12 { grid-column: span 12; }
    .col-8 { grid-column: span 8; }
    .col-6 { grid-column: span 6; }
    .col-4 { grid-column: span 4; }
    .col-3 { grid-column: span 3; }
    .badge-status { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: bold; display: inline-block; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { background: #f1f5f9; padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 10px; text-align: left; color: #475569; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">Receita Federal • Comprovante Cadastral e Participação Societária (QSA)</div>
      <div class="subtitle">Direct Data • Consulta UID: ${metaDados.consultaUid || '-'} • Data: ${metaDados.data || new Date().toLocaleString('pt-BR')}</div>
    </div>

    <div class="grid">
      <div class="box col-4">
        <span class="label">Número de Inscrição (CNPJ)</span>
        <span class="val">${cnpj}</span>
      </div>
      <div class="box col-4">
        <span class="label">Data de Abertura</span>
        <span class="val">${dataAbertura || '-'}</span>
      </div>
      <div class="box col-4">
        <span class="label">Situação Cadastral</span>
        <span class="val badge-status">${situacao} ${dataSituacao ? '(' + dataSituacao + ')' : ''}</span>
      </div>

      <div class="box col-12">
        <span class="label">Nome Empresarial (Razão Social)</span>
        <span class="val" style="font-size: 13px; color: #0f766e;">${razaoSocial}</span>
      </div>

      <div class="box col-8">
        <span class="label">Título do Estabelecimento (Nome Fantasia)</span>
        <span class="val">${nomeFantasia}</span>
      </div>
      <div class="box col-4">
        <span class="label">Porte</span>
        <span class="val">${porte || '-'}</span>
      </div>

      <div class="box col-12">
        <span class="label">Atividade Econômica Principal</span>
        <span class="val">${cnaePrincipal || '-'}</span>
      </div>

      <div class="box col-8">
        <span class="label">Natureza Jurídica</span>
        <span class="val">${natureza || '-'}</span>
      </div>
      <div class="box col-4">
        <span class="label">Capital Social QSA</span>
        <span class="val">${capitalSocial ? 'R$ ' + capitalSocial : '-'}</span>
      </div>

      <div class="box col-12">
        <span class="label">Endereço do Estabelecimento</span>
        <span class="val">${enderecoFormatado}</span>
      </div>

      <div class="box col-6">
        <span class="label">Telefone de Contato</span>
        <span class="val">${telefone}</span>
      </div>
      <div class="box col-6">
        <span class="label">Correio Eletrônico (E-mail)</span>
        <span class="val">${email}</span>
      </div>
    </div>

    <div style="margin-top: 18px;">
      <span class="label" style="font-size: 11px; margin-bottom: 6px;">Quadro de Sócios e Administradores (QSA):</span>
      <table>
        <thead>
          <tr>
            <th>Nome do Sócio / Administrador</th>
            <th>Qualificação</th>
            <th>CPF / CNPJ</th>
            <th style="text-align: center;">% Part.</th>
            <th style="text-align: center;">Data Entrada</th>
          </tr>
        </thead>
        <tbody>
          ${sociosRows}
        </tbody>
      </table>
    </div>

    <div style="margin-top:20px;text-align:center;font-size:10px;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px;">
      Comprovante Oficial Direct Data (ReceitaPJParticipacaoSocietaria) • Validação Sistema Vetline em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
    </div>
  </div>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

/**
 * Consulta oficial da Receita Federal e Quadro Societário na Direct Data (/api/ReceitaPJParticipacaoSocietaria)
 * Utilizada para extrair e anexar o documento oficial do cliente após a conclusão com sucesso do cadastro
 * @param {string} cnpj CNPJ da empresa
 * @returns {Promise<Object>} Resultado padronizado com comprovante oficial em PDF ou HTML
 */
export const consultarDirectDataReceitaPJParticipacaoSocietaria = async (cnpj) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido (deve conter 14 dígitos)' };
  }

  try {
    const params = new URLSearchParams();
    params.append('CNPJ', cleanCnpj);
    params.append('TOKEN', DIRECTD_TOKEN);
    params.append('gerarComprovante', 'true');

    const response = await fetch(`${BASE_URL}/ReceitaPJParticipacaoSocietaria?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Vetline-App/1.0'
      }
    });

    const result = await response.json();
    const meta = result.metaDados || {};
    const retorno = result.retorno || {};

    if (response.ok && retorno && (retorno.numeroInscricao || retorno.nomeEmpresarial || retorno.cnpj || retorno.razaoSocial)) {
      const receiptUrl = meta.urlComprovante || generateReceitaPJParticipacaoSocietariaHtml(retorno, meta);

      const socios = Array.isArray(retorno.socios)
        ? retorno.socios.map(s => ({
            nome: s.nomeEntidade || s.nome || '',
            documento: s.documento || '',
            qualificacao: s.qualificacao || 'Sócio',
            dataEntrada: s.dataEntradaSociedade || s.dataEntrada || '',
            percentual: s.percentualParticipacao || 0
          }))
        : [];

      return {
        success: true,
        data: retorno,
        metaDados: meta,
        razaoSocial: retorno.nomeEmpresarial || retorno.razaoSocial || '',
        nomeFantasia: retorno.nomeFantasia || '',
        dataAbertura: retorno.dataAbertura || retorno.dataFundacao || '',
        situacaoCadastral: retorno.situacaoCadastral || 'Ativa',
        porte: retorno.porte || '',
        naturezaJuridica: retorno.naturezaJuridica || '',
        capitalSocial: retorno.capitalSocialQSA || '',
        socios,
        receiptUrl,
        raw: result
      };
    }

    return {
      success: false,
      code: meta.resultadoId || response.status,
      error: meta.mensagem || meta.resultado || 'Falha na consulta ReceitaPJParticipacaoSocietaria',
      raw: result
    };
  } catch (err) {
    return {
      success: false,
      error: `Erro ao conectar com Direct Data (ReceitaPJParticipacaoSocietaria): ${err.message || 'Erro inesperado'}`
    };
  }
};

/**
 * Gera um comprovante / certidão digital estilizado do SINTEGRA / Cadastro Estadual
 * @param {Object} retorno Dados da consulta do Sintegra
 * @param {Object} metaDados Metadados da consulta
 * @param {string} documento CNPJ / Inscrição Estadual
 * @returns {string} Data URI com HTML formatado
 */
export const generateSintegraDirectDHtml = (retorno = {}, metaDados = {}, documento = '') => {
  const cnpj = retorno.cnpj || documento || '';
  const ie = retorno.ie || '-';
  const razaoSocial = retorno.nomeEmpresarial || '';
  const nomeFantasia = retorno.nomeFantasia || '-';
  const situacao = retorno.situacaoCadastral || 'Habilitado';
  const situacaoCNPJ = retorno.situacaoCNPJ || 'Sem restrição';
  const tipoIE = retorno.tipoIE || 'IE Normal';
  const ufie = retorno.ufie || retorno.uf || 'SP';
  const regime = retorno.regimeApuracao || '-';
  const cnae = retorno.atividadeEconomicaPrincipal || '-';
  const dataConsulta = retorno.dataConsulta || metaDados.data || new Date().toLocaleString('pt-BR');

  const enderecoFormatado = retorno.logradouro
    ? `${retorno.logradouro}, ${retorno.numero || 'S/N'}${retorno.complemento ? ' - ' + retorno.complemento : ''} - ${retorno.bairro || ''}, ${retorno.municipio || ''}/${retorno.uf || ''} - CEP: ${retorno.cep || ''}`
    : '-';

  const isHabilitado = ['HABILITADO', 'ATIVO', 'ATIVA'].includes(String(situacao).trim().toUpperCase());

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante SINTEGRA / CADESP - ${razaoSocial || cnpj}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; }
    .card { max-width: 820px; margin: 0 auto; background: #ffffff; border: 2px solid #0369a1; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px; }
    .header { text-align: center; border-bottom: 2px solid #0369a1; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 15px; font-weight: bold; color: #0369a1; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 4px; }
    .status-box { padding: 14px; border-radius: 8px; text-align: center; margin: 14px 0; }
    .status-ok { background: #dcfce7; border: 2px solid #16a34a; color: #166534; }
    .status-warning { background: #fee2e2; border: 2px solid #dc2626; color: #991b1b; }
    .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 8px; }
    .box { border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 4px; background: #ffffff; }
    .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 2px; }
    .val { font-size: 12px; font-weight: 600; color: #0f172a; }
    .col-12 { grid-column: span 12; }
    .col-6 { grid-column: span 6; }
    .col-4 { grid-column: span 4; }
    .col-3 { grid-column: span 3; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">SINTEGRA - Cadastro Estadual / SEFAZ (${ufie})</div>
      <div class="subtitle">Comprovante de Situação Cadastral Estadual • UID: ${metaDados.consultaUid || '-'}</div>
    </div>

    <div class="grid">
      <div class="box col-6">
        <span class="label">CNPJ</span>
        <span class="val">${cnpj}</span>
      </div>
      <div class="box col-6">
        <span class="label">Inscrição Estadual (IE)</span>
        <span class="val" style="font-size: 13px; color: #0369a1;">${ie} (${tipoIE})</span>
      </div>
    </div>

    <div class="status-box ${isHabilitado ? 'status-ok' : 'status-warning'}">
      <div style="font-size: 15px; font-weight: bold; margin-bottom: 2px;">
        ${isHabilitado ? `✓ SITUAÇÃO CADASTRAL: ${situacao.toUpperCase()}` : `⚠ SITUAÇÃO CADASTRAL: ${situacao.toUpperCase()}`}
      </div>
      <div style="font-size: 11px;">
        Situação no CNPJ: ${situacaoCNPJ} • Regime de Apuração: ${regime}
      </div>
    </div>

    <div class="grid">
      <div class="box col-12">
        <span class="label">Razão Social / Nome Empresarial</span>
        <span class="val">${razaoSocial}</span>
      </div>
      <div class="box col-8">
        <span class="label">Nome Fantasia</span>
        <span class="val">${nomeFantasia}</span>
      </div>
      <div class="box col-4">
        <span class="label">UF da Inscrição</span>
        <span class="val">${ufie}</span>
      </div>
      <div class="box col-12">
        <span class="label">Atividade Econômica (CNAE Principal)</span>
        <span class="val">${cnae}</span>
      </div>
      <div class="box col-12">
        <span class="label">Endereço do Estabelecimento</span>
        <span class="val">${enderecoFormatado}</span>
      </div>
      <div class="box col-6">
        <span class="label">Data da Consulta</span>
        <span class="val">${dataConsulta}</span>
      </div>
      <div class="box col-6">
        <span class="label">Código de Controle / UID</span>
        <span class="val">${metaDados.consultaUid || '-'}</span>
      </div>
    </div>

    <div style="margin-top:20px;text-align:center;font-size:10px;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:8px;">
      Documento gerado via API Direct Data (Sintegra) • Validação Sistema Vetline em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
    </div>
  </div>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

/**
 * Consulta de Protestos no IEPTB / CENPROT Nacional via Direct Data (ProtestosOnline)
 * @param {string} documento CPF ou CNPJ
 * @returns {Promise<Object>} Resultado padronizado
 */
export const consultarDirectDataProtestos = async (documento) => {
  const cleanDoc = String(documento || '').replace(/\D/g, '');
  if (!cleanDoc || (cleanDoc.length !== 11 && cleanDoc.length !== 14)) {
    return { success: false, error: 'Documento inválido para consulta de protestos.' };
  }

  try {
    const params = new URLSearchParams();
    if (cleanDoc.length === 14) {
      params.append('CNPJ', cleanDoc);
    } else {
      params.append('CPF', cleanDoc);
    }
    params.append('TOKEN', DIRECTD_TOKEN);
    params.append('gerarComprovante', 'true');

    const response = await fetch(`${BASE_URL}/ProtestosOnline?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Vetline-App/1.0'
      }
    });

    const result = await response.json();
    const meta = result.metaDados || {};
    const retorno = result.retorno || {};

    if (response.ok && meta.resultadoId === 1 && retorno) {
      const totalProtests = retorno.numeroTotalProtestos ?? 0;
      const receiptUrl = meta.urlComprovante || generateProtestosDirectDHtml(retorno, meta, cleanDoc);

      return {
        success: true,
        totalProtests,
        valorTotalProtestos: retorno.valorTotalProtestos || 'R$ 0,00',
        constamProtestos: retorno.constamProtestos ?? (totalProtests > 0),
        observacoes: retorno.observacoes || (totalProtests === 0 ? 'Não constam protestos' : 'Constam protestos'),
        data: retorno,
        metaDados: meta,
        receiptUrl,
        raw: result
      };
    }

    return {
      success: false,
      code: meta.resultadoId || response.status,
      error: meta.mensagem || meta.resultado || 'Falha na consulta de protestos Direct Data',
      raw: result
    };
  } catch (err) {
    return {
      success: false,
      error: `Erro ao conectar com API de Protestos: ${err.message || 'Erro inesperado'}`
    };
  }
};

/**
 * Consulta de Sintegra / Cadastros Estaduais via Direct Data (/api/Sintegra)
 * @param {string} cnpj CNPJ da empresa
 * @param {string} uf Estado da inscrição (ex: 'SP')
 * @returns {Promise<Object>} Resultado padronizado do Sintegra com IE e comprovante PDF
 */
export const consultarDirectDataSintegra = async (cnpj, uf = 'SP') => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) {
    return { success: false, error: 'CNPJ inválido para consulta do Sintegra.' };
  }

  const cleanUf = String(uf || 'SP').trim().toUpperCase() || 'SP';

  try {
    const params = new URLSearchParams();
    params.append('CNPJ', cleanCnpj);
    params.append('UF', cleanUf);
    params.append('TOKEN', DIRECTD_TOKEN);
    params.append('gerarComprovante', 'true');

    const response = await fetch(`${BASE_URL}/Sintegra?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Vetline-App/1.0'
      }
    });

    const result = await response.json();
    const meta = result.metaDados || {};
    const retorno = result.retorno || {};

    if (response.ok && meta.resultadoId === 1 && retorno) {
      const ie = retorno.ie || null;
      const situacaoCadastral = retorno.situacaoCadastral || 'Habilitado';
      const situacaoCNPJ = retorno.situacaoCNPJ || 'Sem restrição';
      const isHabilitado = ['habilitado', 'ativo', 'ativa'].includes(String(situacaoCadastral).trim().toLowerCase());
      const receiptUrl = meta.urlComprovante || generateSintegraDirectDHtml(retorno, meta, cleanCnpj);

      return {
        success: true,
        ie,
        hasIE: Boolean(ie && ie !== 'ISENTO' && ie !== 'ISENTA' && ie !== '-'),
        situacaoCadastral,
        situacaoCNPJ,
        isHabilitado,
        uf: retorno.ufie || retorno.uf || cleanUf,
        nomeEmpresarial: retorno.nomeEmpresarial || '',
        nomeFantasia: retorno.nomeFantasia || '',
        data: retorno,
        metaDados: meta,
        receiptUrl,
        raw: result
      };
    }

    return {
      success: false,
      code: meta.resultadoId || response.status,
      error: meta.mensagem || meta.resultado || 'Falha na consulta Sintegra na Direct Data',
      raw: result
    };
  } catch (err) {
    return {
      success: false,
      error: `Erro ao conectar com API Sintegra: ${err.message || 'Erro inesperado'}`
    };
  }
};

