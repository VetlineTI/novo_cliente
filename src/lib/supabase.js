import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.EXPO_PUBLIC_SUPABASE_URL || 
  '';

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project-url') &&
  !supabaseAnonKey.includes('your-anon-key')
);

// Inicializa cliente padrão do Supabase (com compatibilidade com schema public e schemas customizados)
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

/**
 * Converte um arquivo File para Data URL (Base64) para pré-visualização instantânea local
 * @param {File} file 
 * @returns {Promise<string>}
 */
const fileToDataUrl = (file) => {
  return new Promise((resolve) => {
    if (!file || typeof file === 'string') {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
};

/**
 * Faz upload de um arquivo para o bucket 'novos_clientes' organizando em pastas com o CNPJ ou CPF do cliente
 * @param {File} file Arquivo a ser enviado
 * @param {string} folder Pasta/categoria do documento (ex: 'documento_identificacao', 'comprovante_endereco')
 * @param {string} clientDocument CPF ou CNPJ do cliente para nomear a pasta
 * @returns {Promise<string>} URL pública ou DataURL do arquivo salvo
 */
export const uploadDocument = async (file, folder = 'geral', clientDocument = '') => {
  if (!file) return null;

  const cleanDoc = (clientDocument || '').replace(/\D/g, '') || 'geral';
  const bucketName = 'novos_clientes';
  const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
  const sanitizedFileName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : `doc_${Date.now()}.${fileExt}`;
  const filePath = `${cleanDoc}/${folder}/${Date.now()}_${sanitizedFileName}`;

  // Se o Supabase estiver configurado
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (data?.path) {
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(data.path);

        return publicUrlData?.publicUrl || `supabase://${bucketName}/${data.path}`;
      }
    } catch (err) {}
  }

  // Modo Local/Demonstração: Converte o arquivo real para Data URL para visualização 100% fiel no admin
  try {
    const dataUrl = await fileToDataUrl(file);
    return dataUrl;
  } catch (e) {
    return `local-storage://${bucketName}/${filePath}`;
  }
};

// Cache em memória para os vendedores
let cachedSalespeople = null;

/**
 * Busca a lista de vendedores da tabela public.vendedor (cd_vend, nome_vendedor)
 * @param {boolean} forceRefresh Força atualização ignorando cache
 * @returns {Promise<{success: boolean, data: Array<{cd_vend: string, nome_vendedor: string}>}>}
 */
export const fetchSalespeople = async (forceRefresh = false) => {
  if (!forceRefresh && cachedSalespeople && cachedSalespeople.length > 0) {
    return { success: true, data: cachedSalespeople };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Tenta consulta direta no schema public
      let res = await supabase
        .from('vendedor')
        .select('*');

      // 2. Se falhar ou vier vazio, tenta explicitar schema public
      if (res.error || !res.data || res.data.length === 0) {
        res = await supabase
          .schema('public')
          .from('vendedor')
          .select('*');
      }

      if (res.data && res.data.length > 0) {
        // Normaliza as colunas e remove ATENA da lista de seleção manual
        const normalized = res.data.map((item) => {
          const cd = item.cd_vend ?? item.CD_VEND ?? item.cd_vendedor ?? item.CD_VENDEDOR ?? item.codigo ?? item.id ?? '';
          const nome = item.nome_vendedor ?? item.NOME_VENDEDOR ?? item.nome ?? item.NOME ?? item.vendedor ?? item.VENDEDOR ?? item.descricao ?? '';
          return {
            cd_vend: String(cd).trim(),
            nome_vendedor: String(nome).trim(),
            nome_equipe: item.nome_equipe || '',
            nome_gerencia: item.nome_gerencia || ''
          };
        }).filter((item) => (
          item.cd_vend && 
          item.nome_vendedor && 
          item.cd_vend.toUpperCase() !== 'ATENA' &&
          !item.nome_vendedor.toUpperCase().includes('ATENA')
        ));

        // Ordena por nome do vendedor
        normalized.sort((a, b) => a.nome_vendedor.localeCompare(b.nome_vendedor, 'pt-BR'));
        cachedSalespeople = normalized;
        return { success: true, data: normalized };
      }
    } catch (err) {
      // ignore
    }
  }

  return { 
    success: true, 
    data: cachedSalespeople || [] 
  };
};

// Cache em memória para os segmentos
let cachedSegments = null;

/**
 * Busca a lista de segmentos/ramos de atividade da tabela novo_cliente.segmento (ram_ativ, descricao)
 * @param {boolean} forceRefresh Força atualização ignorando cache
 * @returns {Promise<{success: boolean, data: Array<{ram_ativ: string, descricao: string}>}>}
 */
export const fetchSegments = async (forceRefresh = false) => {
  if (!forceRefresh && cachedSegments && cachedSegments.length > 0) {
    return { success: true, data: cachedSegments };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Tenta consulta no schema novo_cliente
      let res = await supabase
        .schema('novo_cliente')
        .from('segmento')
        .select('*');

      // 2. Se falhar ou vier vazio, tenta sem schema explícito / schema public
      if (res.error || !res.data || res.data.length === 0) {
        res = await supabase
          .from('segmento')
          .select('*');
      }

      if (res.data && res.data.length > 0) {
        const normalized = res.data.map((item) => {
          const id = item.ram_ativ ?? item.RAM_ATIV ?? item.id ?? item.codigo ?? item.cd_segmento ?? '';
          const desc = item.descricao ?? item.DESCRICAO ?? item.nome ?? item.segmento ?? '';
          return {
            ram_ativ: String(id).trim(),
            descricao: String(desc).trim()
          };
        }).filter((item) => item.descricao && item.ram_ativ);

        if (normalized.length > 0) {
          // Ordena por descrição em ordem alfabética
          normalized.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
          cachedSegments = normalized;
          return { success: true, data: normalized };
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar segmentos do Supabase:', err);
    }
  }

  // Lista padrão de fallback caso a tabela esteja vazia ou em modo offline
  const fallbackList = [
    { ram_ativ: '1', descricao: 'LOJA AGROPECUARIA' },
    { ram_ativ: '2', descricao: 'FORNECEDOR' },
    { ram_ativ: '3', descricao: 'ATACADISTA' },
    { ram_ativ: '4', descricao: 'BANHO E TOSA' },
    { ram_ativ: '5', descricao: 'CLÍNICA COM LOJA' },
    { ram_ativ: '6', descricao: 'CRIADOR' },
    { ram_ativ: '7', descricao: 'CRECHE' },
    { ram_ativ: '8', descricao: 'CLINICA VETERINARIA' },
    { ram_ativ: '9', descricao: 'DISTRIBUIDORA' },
    { ram_ativ: '10', descricao: 'E-COMMERCE' },
    { ram_ativ: '11', descricao: 'FUNCIONARIO' },
    { ram_ativ: '12', descricao: 'HOSPITAL VETERINARIO' },
    { ram_ativ: '13', descricao: 'HOTEL / CRECHE' },
    { ram_ativ: '14', descricao: 'INDUSTRIA VLF' },
    { ram_ativ: '15', descricao: 'INSTITUIÇAO DE ENSINO' },
    { ram_ativ: '16', descricao: 'LABORATORIO DE EXAMES' },
    { ram_ativ: '17', descricao: 'PET SHOP COM BANHO E TOSA' },
    { ram_ativ: '18', descricao: 'PET SHOP COM CLINICA' },
    { ram_ativ: '19', descricao: 'PET SHOP COMPLETO' },
    { ram_ativ: '20', descricao: 'ONGs' },
    { ram_ativ: '21', descricao: 'OUTROS SEGMENTOS' },
    { ram_ativ: '22', descricao: 'PREFEITURA' },
    { ram_ativ: '23', descricao: 'ANIMAIS DE PRODUÇAO' },
    { ram_ativ: '24', descricao: 'PET SHOP GRANEL' },
    { ram_ativ: '25', descricao: 'PET SHOP COM VETERINARIO' },
    { ram_ativ: '26', descricao: 'PET SHOP' },
    { ram_ativ: '27', descricao: 'PRODUTOR RURAL' },
    { ram_ativ: '28', descricao: 'TRANSPORTADORA' },
    { ram_ativ: '29', descricao: 'VETERINARIO AUTONOMO' }
  ];

  return { 
    success: true, 
    data: cachedSegments || fallbackList 
  };
};

/**
 * Normaliza os dados do cliente para manter compatibilidade total
 * e fornecer propriedades tanto em Português BR quanto em aliases de leitura
 * @param {Object} c Registro do cliente
 * @returns {Object}
 */
export const normalizeClientRecord = (c) => {
  if (!c || typeof c !== 'object') return c;
  
  const tipo_pessoa = c.tipo_pessoa || c.person_type || 'PJ';
  const cpf_cnpj = c.cpf_cnpj || c.document_number || '';
  const razao_social_nome = c.razao_social_nome || c.full_name || '';
  const nome_fantasia = c.nome_fantasia || c.trade_name || '';
  const rawNumeroInscricao = c.numero_inscricao ?? c.numero_ie ?? c.ie_number ?? null;
  const isPF = tipo_pessoa === 'PF';
  const tp_inscricao = c.tp_inscricao || c.tipo_inscricao || (
    isPF 
      ? 'I'
      : (rawNumeroInscricao && String(rawNumeroInscricao).toUpperCase() === 'ISENTO' 
          ? 'I' 
          : (c.possui_ie !== undefined ? (c.possui_ie ? 'E' : 'I') : 'E'))
  );
  const numero_inscricao = (isPF || tp_inscricao === 'I') ? 'ISENTO' : (rawNumeroInscricao || '');
  const crmv = c.crmv || c.numero_crmv || c.crmv_number || '';
  const numero_ie = numero_inscricao;
  const possui_ie = tp_inscricao === 'E';
  const telefone = c.telefone || c.phone || '';
  const ram_ativ = c.ram_ativ ?? c.RAM_ATIV ?? c.ramo_atividade ?? c.segmento ?? c.segment ?? '';
  const segmento = c.segmento || c.segment || c.ram_ativ || '';
  const email = c.email || '';
  const cep = c.cep || c.zipcode || '';
  const logradouro = c.logradouro || c.street || '';
  const numero = c.numero || c.number || '';
  const bairro = c.bairro || c.neighborhood || '';
  const complemento = c.complemento || c.complement || '';
  const cidade = c.cidade || c.city || '';
  const uf = c.uf || c.state || '';
  const endereco_entrega_diferente = c.endereco_entrega_diferente !== undefined 
    ? Boolean(c.endereco_entrega_diferente) 
    : Boolean(c.has_different_delivery_address);
  const entrega_cep = c.entrega_cep || c.delivery_zipcode || '';
  const entrega_logradouro = c.entrega_logradouro || c.delivery_street || '';
  const entrega_numero = c.entrega_numero || c.delivery_number || '';
  const entrega_bairro = c.entrega_bairro || c.delivery_neighborhood || '';
  const entrega_complemento = c.entrega_complemento || c.delivery_complement || '';
  const entrega_cidade = c.entrega_cidade || c.delivery_city || '';
  const entrega_uf = c.entrega_uf || c.delivery_state || '';
  const cd_vend = c.cd_vend || 'ATENA';
  const tab_pre = c.tab_pre || 'VTL01';
  const tp_ped = c.tp_ped || 'VTL01';
  const storage_bucket = c.storage_bucket || 'novos_clientes';
  const doc_ie_url = c.doc_ie_url || null;
  const doc_contrato_social_url = c.doc_contrato_social_url || c.doc_contract_url || null;
  const doc_comprovante_endereco_url = c.doc_comprovante_endereco_url || c.doc_address_url || null;
  const doc_identificacao_url = c.doc_identificacao_url || c.doc_photo_id_url || null;
  const doc_crmv_url = c.doc_crmv_url || null;
  const status = c.status || 'pendente';
  const termos_aceitos = c.termos_aceitos !== undefined 
    ? Boolean(c.termos_aceitos) 
    : (c.terms_accepted !== undefined ? Boolean(c.terms_accepted) : true);
  const observacoes = c.observacoes !== undefined ? c.observacoes : (c.notes || '');
  const auth_user_id = c.auth_user_id || null;
  const criado_em = c.criado_em || c.created_at || new Date().toISOString();

  return {
    id: c.id,
    criado_em,
    created_at: criado_em,
    tipo_pessoa,
    person_type: tipo_pessoa,
    cpf_cnpj,
    document_number: cpf_cnpj,
    razao_social_nome,
    full_name: razao_social_nome,
    nome_fantasia,
    trade_name: nome_fantasia,
    tp_inscricao,
    tipo_inscricao: tp_inscricao,
    numero_inscricao,
    crmv,
    numero_crmv: crmv,
    possui_ie,
    has_ie: possui_ie,
    numero_ie,
    ie_number: numero_ie,
    telefone,
    phone: telefone,
    ram_ativ,
    segmento,
    segment: segmento,
    email,
    cep,
    zipcode: cep,
    logradouro,
    street: logradouro,
    numero,
    number: numero,
    bairro,
    neighborhood: bairro,
    complemento,
    complement: complemento,
    cidade,
    city: cidade,
    uf,
    state: uf,
    endereco_entrega_diferente,
    has_different_delivery_address: endereco_entrega_diferente,
    entrega_cep,
    delivery_zipcode: entrega_cep,
    entrega_logradouro,
    delivery_street: entrega_logradouro,
    entrega_numero,
    delivery_number: entrega_numero,
    entrega_bairro,
    delivery_neighborhood: entrega_bairro,
    entrega_complemento,
    delivery_complement: entrega_complemento,
    entrega_cidade,
    delivery_city: entrega_cidade,
    entrega_uf,
    delivery_state: entrega_uf,
    cd_vend,
    tab_pre,
    tp_ped,
    storage_bucket,
    doc_ie_url,
    doc_contrato_social_url,
    doc_contract_url: doc_contrato_social_url,
    doc_comprovante_endereco_url,
    doc_address_url: doc_comprovante_endereco_url,
    doc_identificacao_url,
    doc_photo_id_url: doc_identificacao_url,
    doc_crmv_url,
    doc_receita_url: c.doc_receita_url || null,
    doc_jucesp_url: c.doc_jucesp_url || null,
    doc_cenprot_url: c.doc_cenprot_url || null,
    nire_jucesp: c.nire_jucesp || null,
    total_protestos: c.total_protestos !== undefined ? c.total_protestos : null,
    bureau_consulted_at: c.bureau_consulted_at || null,
    status,
    termos_aceitos,
    terms_accepted: termos_aceitos,
    observacoes,
    notes: observacoes,
    auth_user_id
  };
};

/**
 * Converte um objeto de dados para o payload com colunas em Português BR
 * @param {Object} data 
 * @returns {Object}
 */
export const toPortuguesePayload = (data) => {
  const p = {};
  if (data.tipo_pessoa || data.person_type) p.tipo_pessoa = data.tipo_pessoa || data.person_type;
  
  // Limpa CPF/CNPJ para salvar estritamente apenas números (sem pontos, traços ou barras)
  if (data.cpf_cnpj !== undefined || data.document_number !== undefined) {
    const rawDoc = data.cpf_cnpj || data.document_number;
    p.cpf_cnpj = rawDoc ? String(rawDoc).replace(/\D/g, '') : '';
  }
  
  if (data.razao_social_nome || data.full_name) p.razao_social_nome = data.razao_social_nome || data.full_name;
  if (data.nome_fantasia !== undefined || data.trade_name !== undefined) p.nome_fantasia = data.nome_fantasia || data.trade_name || null;
  
  // Tipo e Número de Inscrição ('E' = Estadual, 'I' = Isento, 'M' = Municipal)
  let resolvedTp = data.tp_inscricao || data.tipo_inscricao || null;
  let resolvedNum = data.numero_inscricao !== undefined 
    ? data.numero_inscricao 
    : (data.numero_ie !== undefined ? data.numero_ie : data.ie_number);

  if (resolvedTp === 'I' || String(resolvedNum).toUpperCase() === 'ISENTO') {
    p.tp_inscricao = 'I';
    p.numero_inscricao = 'ISENTO';
  } else {
    if (resolvedTp) {
      p.tp_inscricao = resolvedTp;
    }
    if (resolvedNum !== undefined) {
      p.numero_inscricao = resolvedNum || 'ISENTO';
    }
  }
  
  // Limpa Telefone/Celular para salvar estritamente apenas números (sem traço, parênteses ou espaços)
  if (data.telefone !== undefined || data.phone !== undefined) {
    const rawPhone = data.telefone || data.phone;
    p.telefone = rawPhone ? String(rawPhone).replace(/\D/g, '') : '';
  }
  
  if (data.ram_ativ !== undefined || data.segmento !== undefined || data.segment !== undefined) {
    const val = data.ram_ativ ?? data.segmento ?? data.segment;
    p.ram_ativ = val;
    p.segmento = val;
  }
  if (data.email !== undefined) p.email = data.email;
  
  // Limpa CEP para apenas números
  if (data.cep !== undefined || data.zipcode !== undefined) {
    const rawCep = data.cep || data.zipcode;
    p.cep = rawCep ? String(rawCep).replace(/\D/g, '') : null;
  }
  
  if (data.logradouro !== undefined || data.street !== undefined) p.logradouro = data.logradouro || data.street || null;
  if (data.numero !== undefined || data.number !== undefined) p.numero = data.numero || data.number || null;
  if (data.bairro !== undefined || data.neighborhood !== undefined) p.bairro = data.bairro || data.neighborhood || null;
  if (data.complemento !== undefined || data.complement !== undefined) p.complemento = data.complemento || data.complement || null;
  if (data.cidade !== undefined || data.city !== undefined) p.cidade = data.cidade || data.city || null;
  if (data.uf !== undefined || data.state !== undefined) p.uf = data.uf || data.state || null;
  if (data.endereco_entrega_diferente !== undefined || data.has_different_delivery_address !== undefined) {
    p.endereco_entrega_diferente = data.endereco_entrega_diferente ?? data.has_different_delivery_address ?? false;
  }
  
  // Limpa CEP de Entrega para apenas números
  if (data.entrega_cep !== undefined || data.delivery_zipcode !== undefined) {
    const rawDelCep = data.entrega_cep || data.delivery_zipcode;
    p.entrega_cep = rawDelCep ? String(rawDelCep).replace(/\D/g, '') : null;
  }
  if (data.entrega_logradouro !== undefined || data.delivery_street !== undefined) p.entrega_logradouro = data.entrega_logradouro || data.delivery_street || null;
  if (data.entrega_numero !== undefined || data.delivery_number !== undefined) p.entrega_numero = data.entrega_numero || data.delivery_number || null;
  if (data.entrega_bairro !== undefined || data.delivery_neighborhood !== undefined) p.entrega_bairro = data.entrega_bairro || data.delivery_neighborhood || null;
  if (data.entrega_complemento !== undefined || data.delivery_complement !== undefined) p.entrega_complemento = data.entrega_complemento || data.delivery_complement || null;
  if (data.entrega_cidade !== undefined || data.delivery_city !== undefined) p.entrega_cidade = data.entrega_cidade || data.delivery_city || null;
  if (data.entrega_uf !== undefined || data.delivery_state !== undefined) p.entrega_uf = data.entrega_uf || data.delivery_state || null;
  if (data.cd_vend) p.cd_vend = data.cd_vend;
  if (data.tab_pre) p.tab_pre = data.tab_pre;
  if (data.tp_ped) p.tp_ped = data.tp_ped;
  if (data.storage_bucket) p.storage_bucket = data.storage_bucket;
  if (data.doc_ie_url !== undefined) p.doc_ie_url = data.doc_ie_url;
  if (data.doc_contrato_social_url !== undefined || data.doc_contract_url !== undefined) {
    p.doc_contrato_social_url = data.doc_contrato_social_url || data.doc_contract_url || null;
  }
  if (data.doc_comprovante_endereco_url !== undefined || data.doc_address_url !== undefined) {
    p.doc_comprovante_endereco_url = data.doc_comprovante_endereco_url || data.doc_address_url || null;
  }
  if (data.doc_identificacao_url !== undefined || data.doc_photo_id_url !== undefined) {
    p.doc_identificacao_url = data.doc_identificacao_url || data.doc_photo_id_url || null;
  }
  if (data.crmv !== undefined || data.numero_crmv !== undefined) {
    p.crmv = data.crmv !== undefined ? data.crmv : data.numero_crmv;
  }
  if (data.doc_crmv_url !== undefined) p.doc_crmv_url = data.doc_crmv_url;
  if (data.doc_receita_url !== undefined) p.doc_receita_url = data.doc_receita_url;
  if (data.doc_jucesp_url !== undefined) p.doc_jucesp_url = data.doc_jucesp_url;
  if (data.doc_cenprot_url !== undefined) p.doc_cenprot_url = data.doc_cenprot_url;
  if (data.nire_jucesp !== undefined) p.nire_jucesp = data.nire_jucesp;
  if (data.total_protestos !== undefined) p.total_protestos = data.total_protestos;
  if (data.bureau_consulted_at !== undefined) p.bureau_consulted_at = data.bureau_consulted_at;
  if (data.status) p.status = data.status;
  if (data.termos_aceitos !== undefined || data.terms_accepted !== undefined) {
    p.termos_aceitos = data.termos_aceitos ?? data.terms_accepted ?? true;
  }
  if (data.observacoes !== undefined || data.notes !== undefined) {
    p.observacoes = data.observacoes !== undefined ? data.observacoes : data.notes;
  }
  if (data.auth_user_id !== undefined) p.auth_user_id = data.auth_user_id;

  return p;
};

/**
 * Salva os dados do formulário na tabela novo_cliente.data_new_cliente
 * (Utiliza RPC pública com SECURITY DEFINER direcionada ao schema novo_cliente e fallback direto)
 * @param {Object} clientData Dados formatados para persistência
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export const submitNewClient = async (clientData) => {
  const ptPayload = toPortuguesePayload(clientData);

  if (isSupabaseConfigured && supabase) {
    // 1. Método Principal: Função RPC insert_novo_cliente
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('insert_novo_cliente', {
        client_payload: ptPayload
      });

      if (!rpcError && rpcData) {
        return { success: true, data: [normalizeClientRecord(rpcData)] };
      }
    } catch (errRpc) {}

    // 2. Método Secundário: Inserção direta no schema novo_cliente (tabela data_new_cliente ou data_new_client)
    try {
      let res = await supabase
        .schema('novo_cliente')
        .from('data_new_cliente')
        .insert([ptPayload])
        .select();

      // Se der erro por nome da tabela antiga, tenta data_new_client
      if (res.error && res.error.message?.includes('relation') && res.error.message?.includes('data_new_cliente')) {
        res = await supabase
          .schema('novo_cliente')
          .from('data_new_client')
          .insert([ptPayload])
          .select();
      }

      if (!res.error && res.data && res.data.length > 0) {
        return { success: true, data: res.data.map(normalizeClientRecord) };
      }

      if (res.error) {
        return { 
          success: false, 
          error: `Erro ao salvar no schema novo_cliente: ${res.error.message}. Execute o script SQL no Supabase.` 
        };
      }
    } catch (errCustom) {
      return { 
        success: false, 
        error: `Falha de conexão com o schema novo_cliente: ${errCustom.message || 'Erro desconhecido'}` 
      };
    }
  }

  // Simulação para testes locais quando Supabase não configurado
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  try {
    const existing = JSON.parse(localStorage.getItem('vetline_saved_clients') || '[]');
    const newRecord = normalizeClientRecord({
      id: crypto.randomUUID(),
      criado_em: new Date().toISOString(),
      status: 'pendente',
      ...ptPayload,
    });
    existing.unshift(newRecord);
    localStorage.setItem('vetline_saved_clients', JSON.stringify(existing));
    return { success: true, data: [newRecord], isDemo: true };
  } catch (e) {}

  return { 
    success: true, 
    data: [normalizeClientRecord({ id: crypto.randomUUID(), ...ptPayload, status: 'pendente' })],
    isDemo: false 
  };
};

/**
 * Obtém a lista de clientes reais salvos localmente
 */
const getLocalClients = () => {
  try {
    const raw = localStorage.getItem('vetline_saved_clients');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const realClientsOnly = parsed.filter((c) => !c.id?.startsWith?.('demo-'));
    if (realClientsOnly.length !== parsed.length) {
      localStorage.setItem('vetline_saved_clients', JSON.stringify(realClientsOnly));
    }
    return realClientsOnly.map(normalizeClientRecord);
  } catch (err) {
    return [];
  }
};

/**
 * Busca a lista de cadastros de clientes exclusivamente do schema novo_cliente
 * @param {Object} options Filtros e opções
 * @returns {Promise<{success: boolean, data: Array, error?: string}>}
 */
export const fetchClients = async (options = {}) => {
  const { status, searchTerm } = options;

  if (isSupabaseConfigured && supabase) {
    // 1. Método Principal: Consulta via RPC get_novo_cliente_clients
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_novo_cliente_clients', {
        p_status: (status && status !== 'todos') ? status : null,
        p_search: (searchTerm && searchTerm.trim()) ? searchTerm.trim() : null
      });

      if (!rpcError && Array.isArray(rpcData)) {
        return { success: true, data: rpcData.map(normalizeClientRecord) };
      }
    } catch (errRpc) {}

    // 2. Método Secundário: Consulta direta no schema novo_cliente
    try {
      let query = supabase
        .schema('novo_cliente')
        .from('data_new_cliente')
        .select('*')
        .order('criado_em', { ascending: false });

      if (status && status !== 'todos') {
        query = query.eq('status', status);
      }

      let { data, error } = await query;

      // Fallback para data_new_client se data_new_cliente ainda não estiver migrada
      if (error) {
        const fallbackRes = await supabase
          .schema('novo_cliente')
          .from('data_new_client')
          .select('*');
        if (!fallbackRes.error && fallbackRes.data) {
          data = fallbackRes.data;
          error = null;
        }
      }

      if (!error && data) {
        let filtered = data.map(normalizeClientRecord);
        if (searchTerm && searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          filtered = filtered.filter((c) => 
            (c.razao_social_nome && c.razao_social_nome.toLowerCase().includes(term)) ||
            (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
            (c.cpf_cnpj && c.cpf_cnpj.includes(term)) ||
            (c.email && c.email.toLowerCase().includes(term)) ||
            (c.telefone && c.telefone.includes(term)) ||
            (c.cidade && c.cidade.toLowerCase().includes(term))
          );
        }
        return { success: true, data: filtered };
      }
    } catch (errCustom) {}
  }

  // Fallback Local Storage
  let clients = getLocalClients();

  if (status && status !== 'todos') {
    clients = clients.filter((c) => c.status === status);
  }

  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    clients = clients.filter((c) => 
      (c.razao_social_nome && c.razao_social_nome.toLowerCase().includes(term)) ||
      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(term)) ||
      (c.cpf_cnpj && c.cpf_cnpj.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.telefone && c.telefone.includes(term)) ||
      (c.cidade && c.cidade.toLowerCase().includes(term)) ||
      (c.logradouro && c.logradouro.toLowerCase().includes(term)) ||
      (c.cep && c.cep.includes(term)) ||
      (c.entrega_cidade && c.entrega_cidade.toLowerCase().includes(term))
    );
  }

  return { success: true, data: clients };
};

/**
 * Atualiza os dados de um cliente exclusivamente no schema novo_cliente
 * @param {string} clientId ID do cliente
 * @param {Object} dataToUpdate Objeto com campos a serem atualizados
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export const updateClientData = async (clientId, dataToUpdate = {}) => {
  const ptPayload = toPortuguesePayload(dataToUpdate);

  if (isSupabaseConfigured && supabase) {
    let lastError = null;

    // 1. Método Principal: Atualização via RPC update_novo_cliente
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('update_novo_cliente', {
        p_client_id: clientId,
        p_payload: ptPayload
      });

      if (!rpcError && rpcData) {
        const normalized = normalizeClientRecord(rpcData);
        updateLocalClientFull(clientId, normalized);
        return { success: true, data: normalized };
      }
      if (rpcError) {
        lastError = rpcError.message;
      }
    } catch (errRpc) {
      lastError = errRpc.message;
    }

    // 2. Método Secundário: Atualização direta no schema novo_cliente
    try {
      let res = await supabase
        .schema('novo_cliente')
        .from('data_new_cliente')
        .update(ptPayload)
        .eq('id', clientId)
        .select();

      if (res.error) {
        lastError = res.error.message;
        res = await supabase
          .schema('novo_cliente')
          .from('data_new_client')
          .update(ptPayload)
          .eq('id', clientId)
          .select();
      }

      if (!res.error && res.data && res.data.length > 0) {
        const normalized = normalizeClientRecord(res.data[0]);
        updateLocalClientFull(clientId, normalized);
        return { success: true, data: normalized };
      }
      if (res.error) {
        lastError = res.error.message;
      }
    } catch (errCustom) {
      lastError = errCustom.message;
    }

    // Se o Supabase estiver configurado e ambas as tentativas falharem, retorna o erro real
    return {
      success: false,
      error: `Erro ao atualizar no banco de dados: ${lastError || 'Operação não pôde ser completada'}`
    };
  }

  // Modo Local/Demo apenas quando o Supabase não está configurado
  const updatedClient = updateLocalClientFull(clientId, normalizeClientRecord({ id: clientId, ...ptPayload }));
  return { success: true, data: updatedClient };
};

/**
 * Atualiza o status e notas/observações de um cliente
 * @param {string} clientId ID do cliente
 * @param {string} newStatus Novo status ('pendente', 'em_analise', 'aprovado', 'recusado')
 * @param {string} notes Anotações do administrador
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export const updateClientStatus = async (clientId, newStatus, notes = '') => {
  return updateClientData(clientId, { status: newStatus, observacoes: notes });
};

/**
 * Atualiza cliente no LocalStorage com todos os campos fornecidos
 */
const updateLocalClientFull = (clientId, dataToUpdate) => {
  try {
    const clients = getLocalClients();
    const index = clients.findIndex((c) => c.id === clientId);
    if (index !== -1) {
      clients[index] = { ...clients[index], ...normalizeClientRecord(dataToUpdate) };
      localStorage.setItem('vetline_saved_clients', JSON.stringify(clients));
      return clients[index];
    }
  } catch (e) {}
  return normalizeClientRecord(dataToUpdate);
};

/**
 * Exclui um cadastro exclusivamente no schema novo_cliente
 */
export const deleteClient = async (clientId) => {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.rpc('delete_novo_cliente', { p_client_id: clientId });
    } catch (errRpc) {}

    try {
      await supabase.schema('novo_cliente').from('data_new_cliente').delete().eq('id', clientId);
    } catch (err) {
      try {
        await supabase.schema('novo_cliente').from('data_new_client').delete().eq('id', clientId);
      } catch (e2) {}
    }
  }

  try {
    const clients = getLocalClients().filter((c) => c.id !== clientId);
    localStorage.setItem('vetline_saved_clients', JSON.stringify(clients));
  } catch (e) {}

  return { success: true };
};

/**
 * Dispara o webhook no N8N ao confirmar / aprovar o cadastro do cliente no Painel Administrativo
 * Webhook URL: https://n8n.srv1055305.hstgr.cloud/webhook/novo-cliente-moinho
 * @param {Object} clientData Dados completos do cliente aprovado
 * @returns {Promise<{success: boolean, status?: number, error?: string, response?: any}>}
 */
export const enviarWebhookNovoClienteMoinho = async (clientData) => {
  const WEBHOOK_URL = 'https://n8n.srv1055305.hstgr.cloud/webhook/novo-cliente-moinho';

  if (!clientData) {
    return { success: false, error: 'Dados do cliente não informados para o webhook.' };
  }

  try {
    const payload = {
      event: 'CLIENT_APPROVED',
      action: 'confirmar_cadastro',
      timestamp: new Date().toISOString(),
      cliente: {
        id: clientData.id || null,
        auth_user_id: clientData.auth_user_id || null,
        tipo_pessoa: clientData.person_type || clientData.tipo_pessoa || 'PJ',
        cpf_cnpj: clientData.document_number || clientData.cpf_cnpj || '',
        razao_social_nome: clientData.full_name || clientData.razao_social_nome || '',
        nome_fantasia: clientData.trade_name || clientData.nome_fantasia || '',
        tp_inscricao: clientData.tp_inscricao || (clientData.person_type === 'PF' ? 'I' : 'E'),
        numero_inscricao: clientData.numero_inscricao || clientData.numero_ie || clientData.ie_number || 'ISENTO',
        crmv: clientData.crmv || clientData.numero_crmv || null,
        telefone: clientData.phone || clientData.telefone || '',
        email: clientData.email || '',
        segmento: clientData.segment || clientData.segmento || clientData.ram_ativ || '',
        ram_ativ: clientData.ram_ativ || clientData.segment || clientData.segmento || '',
        cd_vend: clientData.cd_vend || 'ATENA',
        tab_pre: clientData.tab_pre || 'VTL01',
        tp_ped: clientData.tp_ped || 'VTL01',
        // Endereço Principal / Cadastral
        cep: clientData.zipcode || clientData.cep || '',
        logradouro: clientData.street || clientData.logradouro || '',
        numero: clientData.number || clientData.numero || '',
        complemento: clientData.complement || clientData.complemento || '',
        bairro: clientData.neighborhood || clientData.bairro || '',
        cidade: clientData.city || clientData.cidade || '',
        uf: clientData.state || clientData.uf || '',
        // Endereço de Entrega
        endereco_entrega_diferente: Boolean(clientData.has_different_delivery_address || clientData.endereco_entrega_diferente),
        entrega_cep: clientData.delivery_zipcode || clientData.entrega_cep || null,
        entrega_logradouro: clientData.delivery_street || clientData.entrega_logradouro || null,
        entrega_numero: clientData.delivery_number || clientData.entrega_numero || null,
        entrega_complemento: clientData.delivery_complement || clientData.entrega_complemento || null,
        entrega_bairro: clientData.delivery_neighborhood || clientData.entrega_bairro || null,
        entrega_cidade: clientData.delivery_city || clientData.entrega_cidade || null,
        entrega_uf: clientData.delivery_state || clientData.entrega_uf || null,
        // Documentos Anexados
        doc_contrato_social_url: clientData.doc_contract_url || clientData.doc_contrato_social_url || null,
        doc_identificacao_url: clientData.doc_photo_id_url || clientData.doc_identificacao_url || null,
        doc_crmv_url: clientData.doc_crmv_url || null,
        doc_comprovante_endereco_url: clientData.doc_address_url || clientData.doc_comprovante_endereco_url || null,
        doc_ie_url: clientData.doc_ie_url || clientData.doc_sintegra_url || null,
        doc_jucesp_url: clientData.doc_jucesp_url || null,
        doc_cenprot_url: clientData.doc_cenprot_url || null,
        nire_jucesp: clientData.nire_jucesp || null,
        total_protestos: clientData.total_protestos ?? null,
        // Status e Observações
        status: 'aprovado',
        observacoes: clientData.notes || clientData.observacoes || '',
        approved_at: new Date().toISOString(),
        created_at: clientData.created_at || null
      },
      raw_client: clientData
    };

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    let resData = null;
    try {
      resData = await response.json();
    } catch (_) {
      try {
        resData = await response.text();
      } catch (_) {}
    }

    if (!response.ok) {
      console.warn(`Webhook N8N retornou status ${response.status}:`, resData);
      return {
        success: false,
        status: response.status,
        error: `Webhook retornou status ${response.status}`
      };
    }

    return {
      success: true,
      status: response.status,
      response: resData
    };
  } catch (err) {
    console.error('Erro ao disparar webhook N8N Moinho:', err);
    return {
      success: false,
      error: err.message || 'Falha de conexão com o Webhook N8N'
    };
  }
};
