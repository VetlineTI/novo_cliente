// Utilitário para comunicação com o endpoint de WhatsApp da Z-API

/**
 * Envia o link oficial de confirmação de cadastro do Supabase via Z-API (WhatsApp)
 * @param {Object} params
 * @param {string} params.email E-mail do cliente
 * @param {string} params.phone Telefone/Celular do cliente
 * @param {string} [params.fullName] Nome ou Razão Social
 * @param {string} [params.password] Senha definida (opcional)
 * @param {string} [params.redirectUrl] URL de redirecionamento após confirmação
 * @returns {Promise<{success: boolean, message?: string, error?: string, phone?: string}>}
 */
export const sendWhatsAppSignupConfirmation = async ({
  email,
  phone,
  fullName = '',
  password = '',
  redirectUrl = ''
}) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').replace(/\D/g, '');

  if (!cleanEmail) {
    return { success: false, error: 'E-mail do cliente não informado.' };
  }

  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: 'Telefone do cliente inválido para WhatsApp.' };
  }

  try {
    const targetUrl = '/api/send-whatsapp-signup';
    const finalRedirect = redirectUrl || (typeof window !== 'undefined' ? `${window.location.origin}/` : '');

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: cleanEmail,
        phone: cleanPhone,
        fullName: fullName || cleanEmail.split('@')[0],
        password,
        redirectUrl: finalRedirect
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      return {
        success: true,
        message: data.message || 'Link enviado com sucesso para o WhatsApp!',
        phone: data.phone || cleanPhone
      };
    }

    return {
      success: false,
      error: data.error || `Erro ${response.status} ao disparar WhatsApp de confirmação.`
    };
  } catch (err) {
    console.warn('Falha na requisição de envio de WhatsApp:', err);
    return {
      success: false,
      error: err.message || 'Não foi possível conectar com o servidor para envio de WhatsApp.'
    };
  }
};
