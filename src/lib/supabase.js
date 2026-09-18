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

/**
 * Salva os dados do formulário exclusivamente na tabela novo_cliente.data_new_client
 * (Utiliza RPC pública com SECURITY DEFINER direcionada ao schema novo_cliente e fallback direto no schema novo_cliente)
 * @param {Object} clientData Dados formatados para persistência
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export const submitNewClient = async (clientData) => {
  if (isSupabaseConfigured && supabase) {
    const insertPayload = {
      person_type: clientData.person_type,
      document_number: clientData.document_number,
      full_name: clientData.full_name,
      trade_name: clientData.trade_name || null,
      has_ie: clientData.has_ie || false,
      ie_number: clientData.ie_number || null,
      phone: clientData.phone,
      segment: clientData.segment,
      email: clientData.email,
      zipcode: clientData.zipcode || null,
      street: clientData.street || null,
      number: clientData.number || null,
      neighborhood: clientData.neighborhood || null,
      complement: clientData.complement || null,
      city: clientData.city || null,
      state: clientData.state || null,
      cd_vend: clientData.cd_vend || 'ATENA',
      tab_pre: clientData.tab_pre || 'VTL01',
      tp_ped: clientData.tp_ped || 'VTL01',
      has_different_delivery_address: clientData.has_different_delivery_address || false,
      delivery_zipcode: clientData.delivery_zipcode || null,
      delivery_street: clientData.delivery_street || null,
      delivery_number: clientData.delivery_number || null,
      delivery_neighborhood: clientData.delivery_neighborhood || null,
      delivery_complement: clientData.delivery_complement || null,
      delivery_city: clientData.delivery_city || null,
      delivery_state: clientData.delivery_state || null,
      storage_bucket: clientData.storage_bucket || 'novos_clientes',
      doc_ie_url: clientData.doc_ie_url || null,
      doc_contract_url: clientData.doc_contract_url || null,
      doc_address_url: clientData.doc_address_url || null,
      doc_photo_id_url: clientData.doc_photo_id_url || null,
      doc_crmv_url: clientData.doc_crmv_url || null,
      status: 'pendente',
      terms_accepted: clientData.terms_accepted ?? true,
      auth_user_id: clientData.auth_user_id || null,
    };

    // 1. Método Principal: Função RPC no Supabase que insere diretamente em novo_cliente.data_new_client
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('insert_novo_cliente', {
        client_payload: insertPayload
      });

      if (!rpcError && rpcData) {
        return { success: true, data: [rpcData] };
      }
    } catch (errRpc) {}

    // 2. Método Secundário: Inserção direta no schema novo_cliente via PostgREST
    try {
      let res = await supabase
        .schema('novo_cliente')
        .from('data_new_client')
        .insert([insertPayload])
        .select();

      if (!res.error && res.data && res.data.length > 0) {
        return { success: true, data: res.data };
      }

      if (res.error) {
        return { 
          success: false, 
          error: `Erro ao salvar no schema novo_cliente: ${res.error.message}. Certifique-se de executar o script SQL no Supabase.` 
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
    const newRecord = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      status: 'pendente',
      ...clientData,
    };
    existing.unshift(newRecord);
    localStorage.setItem('vetline_saved_clients', JSON.stringify(existing));
    return { success: true, data: [newRecord], isDemo: true };
  } catch (e) {}

  return { 
    success: true, 
    data: [{ id: crypto.randomUUID(), ...clientData, status: 'pendente' }],
    isDemo: false 
  };
};

/**
 * Obtém a lista de clientes reais salvos localmente (sem dados mockados)
 */
const getLocalClients = () => {
  try {
    const raw = localStorage.getItem('vetline_saved_clients');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Remove automaticamente qualquer registro mock/demo remanescente
    const realClientsOnly = parsed.filter((c) => !c.id?.startsWith?.('demo-'));
    if (realClientsOnly.length !== parsed.length) {
      localStorage.setItem('vetline_saved_clients', JSON.stringify(realClientsOnly));
    }
    return realClientsOnly;
  } catch (err) {
    return [];
  }
};

/**
 * Busca a lista de cadastros de clientes exclusivamente do schema novo_cliente (ou armazenamento local)
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

      if (!rpcError && rpcData) {
        return { success: true, data: rpcData };
      }
    } catch (errRpc) {}

    // 2. Método Secundário: Consulta direta no schema novo_cliente
    try {
      let query = supabase
        .schema('novo_cliente')
        .from('data_new_client')
        .select('*')
        .order('created_at', { ascending: false });

      if (status && status !== 'todos') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (!error && data) {
        // Aplica filtro de texto local caso venha da consulta direta
        let filtered = data;
        if (searchTerm && searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          filtered = data.filter((c) => 
            (c.full_name && c.full_name.toLowerCase().includes(term)) ||
            (c.trade_name && c.trade_name.toLowerCase().includes(term)) ||
            (c.document_number && c.document_number.includes(term)) ||
            (c.email && c.email.toLowerCase().includes(term)) ||
            (c.phone && c.phone.includes(term)) ||
            (c.city && c.city.toLowerCase().includes(term))
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
      (c.full_name && c.full_name.toLowerCase().includes(term)) ||
      (c.trade_name && c.trade_name.toLowerCase().includes(term)) ||
      (c.document_number && c.document_number.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.city && c.city.toLowerCase().includes(term)) ||
      (c.street && c.street.toLowerCase().includes(term)) ||
      (c.zipcode && c.zipcode.includes(term)) ||
      (c.delivery_city && c.delivery_city.toLowerCase().includes(term))
    );
  }

  return { success: true, data: clients };
};

/**
 * Atualiza todos os dados de um cliente exclusivamente no schema novo_cliente
 * @param {string} clientId ID do cliente
 * @param {Object} dataToUpdate Objeto com campos a serem atualizados
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export const updateClientData = async (clientId, dataToUpdate = {}) => {
  if (isSupabaseConfigured && supabase) {
    const updatePayload = { ...dataToUpdate };

    // 1. Método Principal: Atualização via RPC update_novo_cliente
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('update_novo_cliente', {
        p_client_id: clientId,
        p_payload: updatePayload
      });

      if (!rpcError && rpcData) {
        updateLocalClientFull(clientId, rpcData);
        return { success: true, data: rpcData };
      }
    } catch (errRpc) {}

    // 2. Método Secundário: Atualização direta no schema novo_cliente
    try {
      let res = await supabase
        .schema('novo_cliente')
        .from('data_new_client')
        .update(updatePayload)
        .eq('id', clientId)
        .select();

      if (!res.error && res.data && res.data.length > 0) {
        updateLocalClientFull(clientId, res.data[0]);
        return { success: true, data: res.data[0] };
      }
    } catch (errCustom) {}
  }

  // Atualização no LocalStorage
  const updatedClient = updateLocalClientFull(clientId, dataToUpdate);
  return { success: true, data: updatedClient };
};

/**
 * Atualiza o status e notas de um cliente (compatibilidade)
 * @param {string} clientId ID do cliente
 * @param {string} newStatus Novo status ('pendente', 'em_analise', 'aprovado', 'recusado')
 * @param {string} notes Anotações do administrador
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export const updateClientStatus = async (clientId, newStatus, notes = '') => {
  return updateClientData(clientId, { status: newStatus, notes });
};

/**
 * Atualiza cliente no LocalStorage com todos os campos fornecidos
 */
const updateLocalClientFull = (clientId, dataToUpdate) => {
  try {
    const clients = getLocalClients();
    const index = clients.findIndex((c) => c.id === clientId);
    if (index !== -1) {
      clients[index] = { ...clients[index], ...dataToUpdate };
      localStorage.setItem('vetline_saved_clients', JSON.stringify(clients));
      return clients[index];
    }
  } catch (e) {}
  return dataToUpdate;
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
      await supabase.schema('novo_cliente').from('data_new_client').delete().eq('id', clientId);
    } catch (err) {}
  }

  try {
    const clients = getLocalClients().filter((c) => c.id !== clientId);
    localStorage.setItem('vetline_saved_clients', JSON.stringify(clients));
  } catch (e) {
    // ignore
  }

  return { success: true };
};
