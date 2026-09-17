/**
 * Utilitários de Máscaras e Formatações para Formulários Brasileiros
 */

// Limpa todos os caracteres não numéricos
export const unmask = (value = '') => {
  return String(value).replace(/\D/g, '');
};

// Máscara de CPF: 000.000.000-00
export const maskCPF = (value = '') => {
  const clean = unmask(value).slice(0, 11);
  return clean
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

// Máscara de CNPJ: 00.000.000/0000-00
export const maskCNPJ = (value = '') => {
  const clean = unmask(value).slice(0, 14);
  return clean
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

// Máscara dinâmica para CPF ou CNPJ
export const maskCPForCNPJ = (value = '', type = 'PJ') => {
  if (type === 'PF') return maskCPF(value);
  return maskCNPJ(value);
};

// Máscara de Telefone com 8 ou 9 dígitos: (00) 0000-0000 ou (00) 00000-0000
export const maskPhone = (value = '') => {
  const clean = unmask(value).slice(0, 11);
  if (clean.length <= 10) {
    return clean
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return clean
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

// Máscara de CEP: 00000-000
export const maskCEP = (value = '') => {
  const clean = unmask(value).slice(0, 8);
  return clean.replace(/^(\d{5})(\d)/, '$1-$2');
};

// Formatação amigável de tamanho de arquivo
export const formatFileSize = (bytes = 0) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
