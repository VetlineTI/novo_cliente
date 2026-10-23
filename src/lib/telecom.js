/**
 * Módulo de Validação e Inteligência de Telecom (Twilio Lookups v2)
 * Valida VOIP, Tipo de Linha e SIM Swap (troca recente de chip).
 */

/**
 * Consulta a API de telecom para obter operadora, tipo de linha (VOIP/Móvel/Fixo) e SIM Swap
 * @param {string} phone Número de telefone com DDD
 * @returns {Promise<{
 *   success: boolean,
 *   carrier?: string,
 *   line_type?: string,
 *   is_voip?: boolean,
 *   is_mobile?: boolean,
 *   is_landline?: boolean,
 *   sim_swapped_recently?: boolean,
 *   last_sim_swap_date?: string,
 *   sim_swap_status?: string,
 *   risk_level?: 'baixo'|'medio'|'alto'|'indeterminado',
 *   alerts?: string[],
 *   raw?: any
 * }>}
 */
export async function checkPhoneTelecom(phone) {
  if (!phone) {
    return { success: false, error: 'Telefone não informado' };
  }

  try {
    const response = await fetch('/api/telecom-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone })
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Erro HTTP ${response.status}`,
        is_voip: false,
        sim_swapped_recently: false
      };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.warn('[Telecom] Falha não impeditiva ao consultar linha:', err.message);
    return {
      success: false,
      error: err.message,
      is_voip: false,
      sim_swapped_recently: false
    };
  }
}

/**
 * Extrai informações de telecom consolidadas do objeto do cliente
 * (Procura tanto em colunas dedicadas quanto nas observações)
 * @param {Object} client 
 * @returns {{
 *   hasTelecomData: boolean,
 *   carrier: string,
 *   lineType: string,
 *   isVoip: boolean,
 *   isMobile: boolean,
 *   isLandline: boolean,
 *   simSwappedRecently: boolean,
 *   lastSimSwapDate: string|null,
 *   simSwapStatus: string,
 *   riskLevel: string,
 *   alerts: string[]
 * }}
 */
export function extractClientTelecomInfo(client) {
  if (!client) {
    return { hasTelecomData: false };
  }

  // 1. Checa campos diretos
  if (client.telecom_carrier || client.telecom_line_type || client.telecom_is_voip !== undefined) {
    const isVoip = Boolean(client.telecom_is_voip);
    const lineType = client.telecom_line_type || (isVoip ? 'voip' : 'mobile');
    const simSwapped = Boolean(client.telecom_sim_swap);
    
    return {
      hasTelecomData: true,
      carrier: client.telecom_carrier || 'Operadora Móvel',
      lineType: lineType,
      isVoip: isVoip,
      isMobile: lineType === 'mobile',
      isLandline: lineType === 'landline',
      simSwappedRecently: simSwapped,
      lastSimSwapDate: client.telecom_sim_swap_date || null,
      simSwapStatus: simSwapped ? 'swapped_recently' : (client.telecom_sim_status || 'stable'),
      riskLevel: isVoip ? 'alto' : (simSwapped ? 'alto' : 'baixo'),
      alerts: [
        ...(isVoip ? ['Linha virtual / VOIP'] : []),
        ...(simSwapped ? ['Troca recente de chip (SIM Swap)'] : [])
      ]
    };
  }

  // 2. Extrai das observações salvas
  const obs = String(client.observacoes || client.notes || '');
  if (obs.includes('[TELECOM:') || obs.includes('[⚠️ ALERTA TELECOM:')) {
    const isVoip = obs.includes('Linha VOIP') || obs.includes('VOIP: Sim') || obs.includes('(voip)');
    const simSwapped = obs.includes('SIM Swap: Recente') || obs.includes('Troca recente de chip');
    
    // Tenta extrair a operadora: [TELECOM: Vivo ... ou Operadora: Vivo
    const carrierMatch = obs.match(/Operadora:\s*([^|\]]+)/i) || obs.match(/\[TELECOM:\s*([^(|\]]+)/i);
    const carrier = carrierMatch ? carrierMatch[1].trim() : 'Móvel';

    const lineType = isVoip ? 'voip' : (obs.includes('landline') || obs.includes('Fixo') ? 'landline' : 'mobile');

    return {
      hasTelecomData: true,
      carrier: carrier,
      lineType: lineType,
      isVoip: isVoip,
      isMobile: lineType === 'mobile',
      isLandline: lineType === 'landline',
      simSwappedRecently: simSwapped,
      lastSimSwapDate: null,
      simSwapStatus: simSwapped ? 'swapped_recently' : 'stable',
      riskLevel: isVoip ? 'alto' : (simSwapped ? 'alto' : 'baixo'),
      alerts: [
        ...(isVoip ? ['Linha virtual / VOIP'] : []),
        ...(simSwapped ? ['Troca recente de chip (SIM Swap)'] : [])
      ]
    };
  }

  return { hasTelecomData: false };
}
