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

      if (error) {
        console.warn(`Aviso no upload para bucket '${bucketName}':`, error.message);
      } else if (data?.path) {
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(data.path);

        return publicUrlData?.publicUrl || `supabase://${bucketName}/${data.path}`;
      }
    } catch (err) {
      console.error('Erro na integração do Storage Supabase:', err);
    }
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

      if (res.error) {
        console.warn('⚠️ Erro ao consultar tabela public.vendedor no Supabase:', res.error);
      } else if (res.data && res.data.length > 0) {
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

        console.info(`✅ ${normalized.length} vendedores carregados de public.vendedor`);
        cachedSalespeople = normalized;
        return { success: true, data: normalized };
      } else {
        console.warn('⚠️ A tabela public.vendedor retornou 0 registros.');
      }
    } catch (err) {
      console.error('❌ Exceção ao consultar public.vendedor no Supabase:', err);
    }
  }

  return { 
    success: true, 
    data: cachedSalespeople || [] 
  };
};

/**
 * Salva os dados do formulário na tabela data_new_client (tenta no schema public e depois novo_cliente)
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
    };

    // Função de limpeza de payload para colunas opcionais que possam não existir na tabela ainda
    const removeMissingCols = (err, payload) => {
      const p = { ...payload };
      const msg = err?.message || '';
      if (msg.includes('doc_crmv_url')) delete p.doc_crmv_url;
      if (msg.includes('cd_vend')) delete p.cd_vend;
      if (msg.includes('tab_pre')) delete p.tab_pre;
      if (msg.includes('tp_ped')) delete p.tp_ped;
      if (msg.includes('storage_bucket')) delete p.storage_bucket;
      return p;
    };

    // 1. Tentativa prioritária no schema customizado novo_cliente.data_new_client
    try {
      let res = await supabase
        .schema('novo_cliente')
        .from('data_new_client')
        .insert([insertPayload])
        .select();

      if (res.error && (res.error.code === '42703' || res.error.message?.includes('does not exist') || res.error.message?.includes('column'))) {
        const cleanPayload = removeMissingCols(res.error, insertPayload);
        res = await supabase.schema('novo_cliente').from('data_new_client').insert([cleanPayload]).select();
      }

      if (!res.error && res.data) {
        return { success: true, data: res.data };
      }
    } catch (errCustom) {
      console.warn('Tentativa no schema novo_cliente falhou, tentando schema public:', errCustom);
    }

    // 2. Tentativa no schema padrão (public.data_new_client)
    try {
      let res = await supabase
        .from('data_new_client')
        .insert([insertPayload])
        .select();

      if (res.error && (res.error.code === '42703' || res.error.message?.includes('does not exist') || res.error.message?.includes('column'))) {
        const cleanPayload = removeMissingCols(res.error, insertPayload);
        res = await supabase.from('data_new_client').insert([cleanPayload]).select();
      }

      if (!res.error && res.data) {
        return { success: true, data: res.data };
      }

      if (res.error) {
        console.error('Erro na inserção do Supabase:', res.error);
        throw res.error;
      }
    } catch (errPublic) {
      console.error('Falha na integração com Supabase:', errPublic);
      return { success: false, error: errPublic.message || 'Falha ao salvar cadastro no banco' };
    }
  }

  // Simulação para testes locais quando Supabase não configurado
  console.info('ℹ️ Supabase não configurado no .env - Dados salvos no armazenamento local:', clientData);
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
  } catch (e) {
    console.error('Erro ao salvar localmente:', e);
  }

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
    console.error('Erro ao ler clientes do localStorage:', err);
    return [];
  }
};

/**
 * Busca a lista de cadastros de clientes (do Supabase ou do armazenamento local)
 * @param {Object} options Filtros e opções
 * @returns {Promise<{success: boolean, data: Array, error?: string}>}
 */
export const fetchClients = async (options = {}) => {
  const { status, searchTerm } = options;

  if (isSupabaseConfigured && supabase) {
    // 1. Tenta prioritariamente no schema novo_cliente
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
        return { success: true, data };
      }
    } catch (errCustom) {
      // continua para tentar o schema public
    }

    // 2. Fallback no schema public
    try {
      let query = supabase
        .from('data_new_client')
        .select('*')
        .order('created_at', { ascending: false });

      if (status && status !== 'todos') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (!error && data) {
        return { success: true, data };
      }
    } catch (errPublic) {
      console.warn('Falha na requisição ao Supabase, carregando local:', errPublic);
    }
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
      (c.delivery_city && c.delivery_city.toLowerCase().includes(term))
    );
  }

  return { success: true, data: clients };
};

/**
 * Atualiza todos os dados de um cliente (dados cadastrais, comerciais tab_pre/tp_ped/cd_vend, endereço, status e notas)
 * @param {string} clientId ID do cliente
 * @param {Object} dataToUpdate Objeto com campos a serem atualizados
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export const updateClientData = async (clientId, dataToUpdate = {}) => {
  if (isSupabaseConfigured && supabase) {
    const updatePayload = { ...dataToUpdate };
    
    // Função auxiliar para remover colunas opcionais caso ainda não existam no schema
    const removeMissingCols = (err, payload) => {
      const p = { ...payload };
      const msg = err?.message || '';
      if (msg.includes('tab_pre')) delete p.tab_pre;
      if (msg.includes('tp_ped')) delete p.tp_ped;
      if (msg.includes('cd_vend')) delete p.cd_vend;
      if (msg.includes('doc_crmv_url')) delete p.doc_crmv_url;
      if (msg.includes('storage_bucket')) delete p.storage_bucket;
      return p;
    };

    // 1. Tenta prioritariamente no schema novo_cliente
    try {
      let res = await supabase
        .schema('novo_cliente')
        .from('data_new_client')
        .update(updatePayload)
        .eq('id', clientId)
        .select();

      if (res.error && (res.error.code === '42703' || res.error.message?.includes('does not exist') || res.error.message?.includes('column'))) {
        const cleanPayload = removeMissingCols(res.error, updatePayload);
        res = await supabase.schema('novo_cliente').from('data_new_client').update(cleanPayload).eq('id', clientId).select();
      }

      if (!res.error && res.data && res.data.length > 0) {
        updateLocalClientFull(clientId, res.data[0]);
        return { success: true, data: res.data[0] };
      }
    } catch (errCustom) {
      console.warn('Tentativa update novo_cliente falhou:', errCustom);
    }

    // 2. Fallback no schema public
    try {
      let res = await supabase
        .from('data_new_client')
        .update(updatePayload)
        .eq('id', clientId)
        .select();

      if (res.error && (res.error.code === '42703' || res.error.message?.includes('does not exist') || res.error.message?.includes('column'))) {
        const cleanPayload = removeMissingCols(res.error, updatePayload);
        res = await supabase.from('data_new_client').update(cleanPayload).eq('id', clientId).select();
      }

      if (!res.error && res.data && res.data.length > 0) {
        updateLocalClientFull(clientId, res.data[0]);
        return { success: true, data: res.data[0] };
      }
    } catch (errPublic) {
      console.warn('Falha ao atualizar cliente no schema public:', errPublic);
    }
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
  } catch (e) {
    console.error('Erro ao atualizar no localStorage:', e);
  }
  return dataToUpdate;
};

/**
 * Exclui um cadastro
 */
export const deleteClient = async (clientId) => {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.schema('novo_cliente').from('data_new_client').delete().eq('id', clientId);
    } catch (err) {}
    try {
      await supabase.from('data_new_client').delete().eq('id', clientId);
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
