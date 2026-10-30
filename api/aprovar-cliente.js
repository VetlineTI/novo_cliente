import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// Serverless Function / Proxy Seguro: Aprovação de Cliente no ERP (N8N / Moinho)
// ==============================================================================
// 1. Validação de Autenticação e Perfil de Admin
// 2. Busca os dados reais e imutáveis direto do banco de dados pelo ID (não aceita JSON manipulado)
// 3. Dispara o webhook no n8n a partir do servidor com segredo e URL protegidos
// ==============================================================================

const N8N_MOINHO_WEBHOOK_URL = 
  process.env.N8N_MOINHO_WEBHOOK_URL || 
  'https://n8n.srv1055305.hstgr.cloud/webhook/novo-cliente-moinho';

const N8N_WEBHOOK_SECRET = 
  process.env.N8N_WEBHOOK_SECRET || 
  process.env.INTERNAL_API_SECRET || 
  '';

export default async function handler(req, res) {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, error: 'Configuração do Supabase incompleta no servidor.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. VALIDAÇÃO DE AUTENTICAÇÃO E PERFIL ADMIN
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    let isAuthorized = false;
    let callerEmail = 'admin';

    if (token) {
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (!userError && userData?.user) {
        const callerId = userData.user.id;
        callerEmail = userData.user.email || '';

        // Verifica se o usuário tem role 'admin' ou 'operador' em admin_profiles
        const { data: profile } = await supabaseAdmin
          .schema('novo_cliente')
          .from('admin_profiles')
          .select('role, is_admin')
          .eq('id', callerId)
          .maybeSingle();

        if (profile && (profile.is_admin || ['admin', 'operador'].includes(profile.role))) {
          isAuthorized = true;
        }
      }
    }

    // Se não tiver token Supabase Auth mas possuir uma chave mestra interna ou for sessão de emergência autenticada
    if (!isAuthorized) {
      const reqSecret = req.headers['x-admin-secret'] || req.body?.admin_secret;
      if (reqSecret && reqSecret === process.env.ADMIN_EMERGENCY_SECRET) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado: apenas administradores autorizados podem aprovar clientes no ERP.'
      });
    }

    // 2. BUSCA DO CADASTRO NO BANCO PELO ID (Fonte única de verdade - Nunca confia no payload do navegador)
    const { clientId } = req.body || {};
    if (!clientId) {
      return res.status(400).json({ success: false, error: 'clientId é obrigatório.' });
    }

    const { data: clientRecord, error: clientError } = await supabaseAdmin
      .schema('novo_cliente')
      .from('data_new_cliente')
      .select('*')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError || !clientRecord) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado no banco de dados.' });
    }

    // 3. MONTA O PAYLOAD OFICIAL COM OS DADOS REAIS DO BANCO
    const payload = {
      event: 'CLIENT_APPROVED',
      action: 'confirmar_cadastro',
      timestamp: new Date().toISOString(),
      aprovado_por: callerEmail,
      cliente: {
        id: clientRecord.id,
        auth_user_id: clientRecord.auth_user_id || null,
        tipo_pessoa: clientRecord.tipo_pessoa || 'PJ',
        cpf_cnpj: clientRecord.cpf_cnpj || '',
        razao_social_nome: clientRecord.razao_social_nome || '',
        nome_fantasia: clientRecord.nome_fantasia || '',
        tp_inscricao: clientRecord.tp_inscricao || (clientRecord.tipo_pessoa === 'PF' ? 'I' : 'E'),
        numero_inscricao: clientRecord.numero_inscricao || clientRecord.numero_ie || 'ISENTO',
        crmv: clientRecord.crmv || null,
        telefone: clientRecord.telefone || '',
        email: clientRecord.email || '',
        segmento: clientRecord.segmento || clientRecord.ram_ativ || '',
        ram_ativ: clientRecord.ram_ativ || clientRecord.segmento || '',
        cd_vend: clientRecord.cd_vend || 'ATENA',
        tab_pre: clientRecord.tab_pre || 'VTL01',
        tp_ped: clientRecord.tp_ped || 'VTL01',
        limite_credito: Number(clientRecord.limite_credito || 0),
        cep: clientRecord.cep || '',
        logradouro: clientRecord.logradouro || '',
        numero: clientRecord.numero || '',
        complemento: clientRecord.complemento || '',
        bairro: clientRecord.bairro || '',
        cidade: clientRecord.cidade || '',
        uf: clientRecord.uf || '',
        endereco_entrega_diferente: Boolean(clientRecord.endereco_entrega_diferente),
        entrega_cep: clientRecord.entrega_cep || null,
        entrega_logradouro: clientRecord.entrega_logradouro || null,
        entrega_numero: clientRecord.entrega_numero || null,
        entrega_complemento: clientRecord.entrega_complemento || null,
        entrega_bairro: clientRecord.entrega_bairro || null,
        entrega_cidade: clientRecord.entrega_cidade || null,
        entrega_uf: clientRecord.entrega_uf || null,
        doc_contrato_social_url: clientRecord.doc_contrato_social_url || null,
        doc_identificacao_url: clientRecord.doc_identificacao_url || null,
        doc_crmv_url: clientRecord.doc_crmv_url || null,
        doc_comprovante_endereco_url: clientRecord.doc_comprovante_endereco_url || null,
        doc_ie_url: clientRecord.doc_ie_url || null,
        doc_jucesp_url: clientRecord.doc_jucesp_url || null,
        doc_cenprot_url: clientRecord.doc_cenprot_url || null,
        nire_jucesp: clientRecord.nire_jucesp || null,
        status: 'aprovado',
        observacoes: clientRecord.observacoes || '',
        approved_at: new Date().toISOString(),
        created_at: clientRecord.criado_em || clientRecord.created_at || null
      }
    };

    // 4. DISPARO DO WEBHOOK NO N8N COM SEGREDO DO SERVIDOR
    const headers = {
      'Content-Type': 'application/json'
    };
    if (N8N_WEBHOOK_SECRET) {
      headers['X-Webhook-Secret'] = N8N_WEBHOOK_SECRET;
      headers['Authorization'] = `Bearer ${N8N_WEBHOOK_SECRET}`;
    }

    const n8nResponse = await fetch(N8N_MOINHO_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const responseText = await n8nResponse.text();
    let responseData = null;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    return res.status(200).json({
      success: n8nResponse.ok,
      status: n8nResponse.status,
      data: responseData
    });
  } catch (err) {
    console.error('Erro na rota aprovar-cliente:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erro interno no servidor' });
  }
}

