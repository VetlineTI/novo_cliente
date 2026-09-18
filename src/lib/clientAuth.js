import { supabase, isSupabaseConfigured, submitNewClient, updateClientData, uploadDocument } from './supabase';

// ==============================================================================
// Módulo de Autenticação e Gestão de Perfil do Cliente Vetline
// ==============================================================================

const CLIENT_STORAGE_KEY = 'vetline_client_session';
const CLIENT_ACCOUNTS_LOCAL_KEY = 'vetline_client_auth_accounts';

/**
 * Obtém a sessão ativa do cliente
 */
export const getClientSession = () => {
  try {
    const raw = localStorage.getItem(CLIENT_STORAGE_KEY) || sessionStorage.getItem(CLIENT_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.isAuthenticated) {
      return session;
    }
  } catch (err) {
    console.error('Erro ao ler sessão do cliente:', err);
  }
  return null;
};

/**
 * Salva a sessão do cliente no storage
 */
export const saveClientSession = (sessionData, rememberMe = true) => {
  try {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(sessionData));
    // Limpa a outra storage para evitar duplicidade
    if (rememberMe) {
      sessionStorage.removeItem(CLIENT_STORAGE_KEY);
    } else {
      localStorage.removeItem(CLIENT_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Erro ao salvar sessão do cliente:', err);
  }
};

/**
 * Encerra a sessão do cliente
 */
export const logoutClient = async () => {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
  }
  localStorage.removeItem(CLIENT_STORAGE_KEY);
  sessionStorage.removeItem(CLIENT_STORAGE_KEY);
};

/**
 * Busca o registro completo do cliente no banco pelo auth_user_id ou e-mail
 * @param {string} authUserId ID do usuário em auth.users
 * @param {string} email E-mail do cliente
 * @returns {Promise<Object|null>}
 */
export const fetchClientRecord = async (authUserId, email) => {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (isSupabaseConfigured && supabase) {
    // 1. Método Principal: Consulta via RPC no PostgreSQL
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_novo_cliente_by_user_or_email', {
        p_user_id: authUserId || null,
        p_email: cleanEmail || null
      });

      if (!rpcError && rpcData && rpcData.id) {
        if (authUserId && !rpcData.auth_user_id) {
          updateClientData(rpcData.id, { auth_user_id: authUserId }).catch(() => {});
        }
        return rpcData;
      }
    } catch (errRpc) {
      console.warn('Tentativa RPC get_novo_cliente_by_user_or_email falhou:', errRpc);
    }

    // 2. Método Secundário: Consulta direta no schema novo_cliente por auth_user_id
    if (authUserId) {
      try {
        const { data, error } = await supabase
          .schema('novo_cliente')
          .from('data_new_client')
          .select('*')
          .eq('auth_user_id', authUserId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          return data[0];
        }
      } catch (err) {}
    }

    // 3. Consulta direta no schema novo_cliente por e-mail
    if (cleanEmail) {
      try {
        const { data, error } = await supabase
          .schema('novo_cliente')
          .from('data_new_client')
          .select('*')
          .ilike('email', cleanEmail)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          if (authUserId && !data[0].auth_user_id) {
            updateClientData(data[0].id, { auth_user_id: authUserId }).catch(() => {});
          }
          return data[0];
        }
      } catch (err) {}
    }
  }

  // Fallback Local Storage
  try {
    const raw = localStorage.getItem('vetline_saved_clients');
    if (raw) {
      const clients = JSON.parse(raw);
      if (Array.isArray(clients)) {
        const found = clients.find(c => 
          (authUserId && c.auth_user_id === authUserId) ||
          (cleanEmail && c.email && c.email.toLowerCase() === cleanEmail)
        );
        if (found) return found;
      }
    }
  } catch (e) {
    console.error('Erro ao ler clientes do storage local:', e);
  }

  return null;
};

/**
 * Cria a conta no Supabase Auth e salva o cadastro do cliente vinculado
 * @param {Object} clientData Dados preenchidos no formulário
 * @param {string} password Senha definida na modal
 * @returns {Promise<{success: boolean, client?: Object, session?: Object, error?: string}>}
 */
export const registerClientWithAuth = async (clientData, password) => {
  const cleanEmail = (clientData.email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanEmail) {
    return { success: false, error: 'E-mail do cliente é obrigatório.' };
  }
  if (!cleanPassword || cleanPassword.length < 6) {
    return { success: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
  }

  let authUser = null;
  let authUserId = null;

  // 1. Cria ou vincula usuário no Supabase Auth
  if (isSupabaseConfigured && supabase) {
    // 1.1 Método Prioritário: Função RPC que vincula usuário existente em auth.users sem conflito com outros sistemas
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('ensure_client_auth_user', {
        p_email: cleanEmail,
        p_password: cleanPassword,
        p_full_name: clientData.full_name || ''
      });

      if (!rpcErr && rpcRes?.success && rpcRes?.user_id) {
        authUserId = rpcRes.user_id;

        // Tenta iniciar sessão no Supabase Auth com a nova senha vinculada
        try {
          const { data: loginData } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword,
          });
          if (loginData?.user) {
            authUser = loginData.user;
          }
        } catch (signErr) {
          console.warn('Sessão após vinculação RPC:', signErr);
        }
      }
    } catch (errRpc) {
      console.warn('RPC ensure_client_auth_user indisponível, usando método padrão:', errRpc);
    }

    // 1.2 Método Padrão: signUp / signIn caso a RPC ainda não tenha sido criada
    if (!authUserId) {
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: clientData.full_name || '',
              role: 'cliente',
              document_number: clientData.document_number || '',
              phone: clientData.phone || '',
            }
          }
        });

        if (signUpError) {
          // Se o e-mail já existir no auth (de outros sistemas ou cadastro prévio)
          if (signUpError.message?.includes('already registered') || signUpError.message?.includes('already exists') || signUpError.status === 422) {
            // Tenta fazer login caso a senha coincida
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: cleanPassword,
            });

            if (!loginError && loginData?.user) {
              authUser = loginData.user;
              authUserId = authUser.id;
            } else {
              // Se a senha for diferente (outro sistema), gera um identificador vinculado para não travar o cliente
              authUserId = `existing-auth-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            }
          } else {
            console.warn('Aviso no signUp do Supabase Auth:', signUpError.message);
          }
        } else if (signUpData?.user) {
          authUser = signUpData.user;
          authUserId = authUser.id;
        }
      } catch (authErr) {
        console.warn('Exceção no cadastro Supabase Auth:', authErr);
      }
    }
  }

  // 2. Salva o registro em data_new_client com auth_user_id
  const payloadToSave = {
    ...clientData,
    auth_user_id: authUserId || `local-auth-${Date.now()}`
  };

  const submitResult = await submitNewClient(payloadToSave);

  if (!submitResult.success) {
    return {
      success: false,
      error: submitResult.error || 'Erro ao persistir dados do cliente no banco.'
    };
  }

  const savedClient = submitResult.data?.[0] || {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    status: 'pendente',
    ...payloadToSave
  };

  // Salva no registro local de contas para acesso contínuo
  try {
    const rawAccs = localStorage.getItem(CLIENT_ACCOUNTS_LOCAL_KEY) || '[]';
    const accs = JSON.parse(rawAccs);
    const existingIdx = accs.findIndex(a => a.email === cleanEmail);
    const accData = {
      email: cleanEmail,
      password: cleanPassword,
      auth_user_id: savedClient.auth_user_id,
      clientId: savedClient.id
    };
    if (existingIdx >= 0) {
      accs[existingIdx] = accData;
    } else {
      accs.push(accData);
    }
    localStorage.setItem(CLIENT_ACCOUNTS_LOCAL_KEY, JSON.stringify(accs));
  } catch (e) {}

  // Cria a sessão ativa do cliente
  const clientSession = {
    isAuthenticated: true,
    authUserId: authUser?.id || savedClient.auth_user_id || authUserId,
    email: cleanEmail,
    fullName: clientData.full_name,
    client: savedClient,
    loginTime: new Date().toISOString(),
    isSupabaseAuth: Boolean(authUser)
  };

  saveClientSession(clientSession, true);

  return {
    success: true,
    client: savedClient,
    session: clientSession
  };
};

/**
 * Realiza o login do cliente no Portal (Supabase Auth + busca cadastral)
 * @param {string} email E-mail do cliente
 * @param {string} password Senha
 * @param {boolean} rememberMe Lembrar sessão
 * @returns {Promise<{success: boolean, session?: Object, client?: Object, error?: string}>}
 */
export const loginClient = async (email, password, rememberMe = true) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Informe seu e-mail e senha cadastrados.' };
  }

  let authUser = null;

  // 1. Tenta autenticação no Supabase Auth
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!authError && authData?.user) {
        authUser = authData.user;
      } else if (authError) {
        console.warn('Supabase Auth client login error:', authError.message);
        if (authError.message?.includes('Email not confirmed')) {
          return {
            success: false,
            error: 'E-mail não confirmado no Supabase. Por favor, confirme o e-mail ou contate o suporte.'
          };
        }
      }
    } catch (err) {
      console.warn('Erro ao autenticar cliente no Supabase Auth:', err);
    }
  }

  // 2. Busca os dados cadastrais do cliente
  let clientRecord = await fetchClientRecord(authUser?.id, cleanEmail);

  // Se não autenticou no Supabase Auth, verifica no fallback local
  if (!authUser) {
    try {
      const rawAccs = localStorage.getItem(CLIENT_ACCOUNTS_LOCAL_KEY) || '[]';
      const accs = JSON.parse(rawAccs);
      const matched = accs.find(a => a.email.toLowerCase() === cleanEmail && a.password === cleanPassword);

      if (matched) {
        if (!clientRecord) {
          clientRecord = await fetchClientRecord(matched.auth_user_id, cleanEmail);
        }
      } else if (!clientRecord) {
        return {
          success: false,
          error: 'E-mail ou senha incorretos. Caso ainda não tenha cadastro, acesse a aba "Ainda não sou cliente".'
        };
      }
    } catch (e) {}
  }

  // Se for o primeiro login e cliente existir no banco mas não ter senha mockada
  if (!clientRecord && authUser) {
    // Cria um registro mínimo
    clientRecord = {
      id: crypto.randomUUID(),
      auth_user_id: authUser.id,
      email: cleanEmail,
      full_name: authUser.user_metadata?.full_name || cleanEmail.split('@')[0],
      status: 'pendente',
      created_at: new Date().toISOString()
    };
  }

  if (!clientRecord) {
    return {
      success: false,
      error: 'Cadastro não encontrado para este e-mail. Caso ainda não seja nosso cliente, faça seu cadastro na aba "Ainda não sou cliente".'
    };
  }

  const clientSession = {
    isAuthenticated: true,
    authUserId: authUser?.id || clientRecord.auth_user_id || `user-${clientRecord.id}`,
    email: cleanEmail,
    fullName: clientRecord.full_name || clientRecord.trade_name || cleanEmail.split('@')[0],
    client: clientRecord,
    loginTime: new Date().toISOString(),
    isSupabaseAuth: Boolean(authUser)
  };

  saveClientSession(clientSession, rememberMe);

  return {
    success: true,
    session: clientSession,
    client: clientRecord
  };
};

/**
 * Atualiza os dados cadastrais do cliente a partir do seu painel
 * @param {string} clientId ID do registro em data_new_client
 * @param {Object} updatedFields Campos alterados
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const updateClientProfile = async (clientId, updatedFields) => {
  if (!clientId) {
    return { success: false, error: 'ID do cliente não informado.' };
  }

  const res = await updateClientData(clientId, updatedFields);

  if (res.success && res.data) {
    // Atualiza a sessão ativa em memória e storage
    const currentSession = getClientSession();
    if (currentSession) {
      currentSession.client = { ...currentSession.client, ...res.data };
      if (res.data.full_name) {
        currentSession.fullName = res.data.full_name;
      }
      saveClientSession(currentSession, true);
    }
  }

  return res;
};

/**
 * Faz upload de um documento novo ou de substituição e atualiza no cadastro do cliente
 * @param {string} clientId ID do cliente
 * @param {File} file Arquivo a enviar
 * @param {string} folder Categoria do documento (ex: 'contrato_social', 'comprovante_endereco')
 * @param {string} clientDocument CPF ou CNPJ
 * @param {string} fieldName Nome da coluna no banco (ex: 'doc_contract_url', 'doc_address_url', 'doc_photo_id_url', 'doc_crmv_url')
 * @returns {Promise<{success: boolean, url?: string, data?: Object, error?: string}>}
 */
export const reuploadClientDocument = async (clientId, file, folder, clientDocument, fieldName) => {
  if (!clientId || !file || !fieldName) {
    return { success: false, error: 'Parâmetros incompletos para reenvio do documento.' };
  }

  try {
    // 1. Faz upload do arquivo
    const uploadedUrl = await uploadDocument(file, folder, clientDocument);

    if (!uploadedUrl) {
      return { success: false, error: 'Não foi possível carregar o documento. Tente novamente.' };
    }

    // 2. Atualiza a coluna do documento no registro do cliente
    const updatePayload = {
      [fieldName]: uploadedUrl
    };

    const updateRes = await updateClientData(clientId, updatePayload);

    if (!updateRes.success) {
      return { success: false, error: updateRes.error || 'Erro ao salvar novo anexo no cadastro.' };
    }

    // 3. Atualiza sessão local
    const currentSession = getClientSession();
    if (currentSession) {
      currentSession.client = { ...currentSession.client, [fieldName]: uploadedUrl };
      saveClientSession(currentSession, true);
    }

    return {
      success: true,
      url: uploadedUrl,
      data: updateRes.data
    };
  } catch (err) {
    console.error('Erro no reenvio de documento:', err);
    return { success: false, error: err.message || 'Erro ao reenviar documento.' };
  }
};

/**
 * Envia e-mail de recuperação de senha com link mágico do Supabase Auth
 * @param {string} email E-mail cadastrado
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export const sendPasswordResetEmail = async (email) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  
  if (!cleanEmail) {
    return { success: false, error: 'Por favor, informe seu e-mail para recuperar a senha.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const redirectUrl = `${window.location.origin}/?type=recovery`;
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.warn('Erro ao solicitar redefinição de senha:', error.message);
        return { 
          success: false, 
          error: error.message || 'Não foi possível enviar o e-mail de recuperação. Verifique o endereço digitado.' 
        };
      }

      return { 
        success: true, 
        message: `Enviamos um link de recuperação para o e-mail ${cleanEmail}. Verifique sua caixa de entrada e spam.` 
      };
    } catch (err) {
      console.error('Exceção ao enviar redefinição:', err);
      return { success: false, error: err.message || 'Erro ao enviar solicitação de recuperação.' };
    }
  }

  // Modo Demonstração / Fallback
  return { 
    success: true, 
    message: `Link de recuperação enviado com sucesso para ${cleanEmail}!` 
  };
};

/**
 * Atualiza a senha do usuário após acessar o link de recuperação
 * @param {string} newPassword Nova senha
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export const updateUserPassword = async (newPassword) => {
  const cleanPass = (newPassword || '').trim();

  if (!cleanPass || cleanPass.length < 6) {
    return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: cleanPass,
      });

      if (error) {
        console.warn('Erro ao atualizar senha no Supabase Auth:', error.message);
        return { 
          success: false, 
          error: error.message || 'Não foi possível redefinir sua senha. O link pode ter expirado.' 
        };
      }

      return { success: true, user: data?.user };
    } catch (err) {
      console.error('Exceção ao atualizar senha:', err);
      return { success: false, error: err.message || 'Erro ao salvar nova senha.' };
    }
  }

  return { success: true };
};

