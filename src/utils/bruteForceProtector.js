/**
 * Utilitário de Proteção contra Ataques de Força Bruta (Brute-Force Protection)
 * - Limite de 5 tentativas consecutivas de senha incorreta
 * - Bloqueio temporário de 5 minutos (300 segundos)
 * - Persistência no LocalStorage com contagem regressiva
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutos (300.000 ms)

/**
 * Consulta o status atual de bloqueio de um identificador (e-mail)
 * @param {string} identifier E-mail do usuário
 * @returns {{ isLocked: boolean, remainingSeconds: number, attemptsLeft: number, attemptsMade: number }}
 */
export const getBruteForceStatus = (identifier) => {
  if (!identifier || typeof identifier !== 'string') {
    return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS, attemptsMade: 0 };
  }

  const cleanId = identifier.toLowerCase().trim();
  const key = `bf_lock_${cleanId}`;
  
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS, attemptsMade: 0 };
    }

    const data = JSON.parse(raw);
    const now = Date.now();

    // 1. Se estiver dentro do tempo de bloqueio
    if (data.lockedUntil && data.lockedUntil > now) {
      const remainingSeconds = Math.max(1, Math.ceil((data.lockedUntil - now) / 1000));
      return {
        isLocked: true,
        remainingSeconds,
        attemptsLeft: 0,
        attemptsMade: data.attempts || MAX_ATTEMPTS
      };
    }

    // 2. Se o tempo de bloqueio já expirou, reseta o histórico
    if (data.lockedUntil && data.lockedUntil <= now) {
      localStorage.removeItem(key);
      return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS, attemptsMade: 0 };
    }

    // 3. Se ainda não atingiu o limite de bloqueio
    const attempts = data.attempts || 0;
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attempts);

    return {
      isLocked: false,
      remainingSeconds: 0,
      attemptsLeft,
      attemptsMade: attempts
    };
  } catch (err) {
    return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS, attemptsMade: 0 };
  }
};

/**
 * Registra uma tentativa de login com falha (senha incorreta)
 * @param {string} identifier E-mail do usuário
 * @returns {{ isLocked: boolean, remainingSeconds: number, attemptsLeft: number }}
 */
export const recordFailedLogin = (identifier) => {
  if (!identifier || typeof identifier !== 'string') return getBruteForceStatus('');

  const cleanId = identifier.toLowerCase().trim();
  const key = `bf_lock_${cleanId}`;
  const now = Date.now();

  try {
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : {};
    const newAttempts = (data.attempts || 0) + 1;

    if (newAttempts >= MAX_ATTEMPTS) {
      // Bloqueia por 5 minutos
      const lockedUntil = now + LOCKOUT_DURATION_MS;
      localStorage.setItem(key, JSON.stringify({
        attempts: newAttempts,
        lockedUntil,
        lastAttempt: now
      }));

      return {
        isLocked: true,
        remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        attemptsLeft: 0,
        attemptsMade: newAttempts
      };
    }

    localStorage.setItem(key, JSON.stringify({
      attempts: newAttempts,
      lastAttempt: now
    }));

    return {
      isLocked: false,
      remainingSeconds: 0,
      attemptsLeft: MAX_ATTEMPTS - newAttempts,
      attemptsMade: newAttempts
    };
  } catch (err) {
    return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS, attemptsMade: 0 };
  }
};

/**
 * Reseta o histórico de falhas após login efetuado com sucesso
 * @param {string} identifier E-mail do usuário
 */
export const resetBruteForce = (identifier) => {
  if (!identifier || typeof identifier !== 'string') return;
  const cleanId = identifier.toLowerCase().trim();
  const key = `bf_lock_${cleanId}`;
  try {
    localStorage.removeItem(key);
  } catch (err) {}
};

/**
 * Formata segundos em formato MM:SS para exibição amigável
 * @param {number} seconds 
 * @returns {string} ex: "04:59"
 */
export const formatRemainingTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
