import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Save, 
  Loader2, 
  Check, 
  HelpCircle,
  Building2,
  Sparkles
} from 'lucide-react';
import { maskPhone, maskCEP } from '../../utils/masks';
import { fetchAddressByCEP, validateEmail } from '../../utils/validators';

/**
 * Modal Interativo de Verificação Obrigatória de Dados Cadastrais
 * Exigido sempre que um cliente cadastrado tenta salvar alterações no perfil.
 * Valida sequencialmente: Telefone -> E-mail -> Endereço.
 */
export const ClientVerificationModal = ({
  isOpen,
  onClose,
  initialData,
  onConfirmAndSave,
  isSaving = false
}) => {
  const [step, setStep] = useState(1); // 1: Telefone, 2: E-mail, 3: Endereço

  // Dados da verificação
  const [phone, setPhone] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const [email, setEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [addressData, setAddressData] = useState({
    zipcode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);

  // Inicializa quando abre o modal
  useEffect(() => {
    if (isOpen && initialData) {
      setStep(1);
      setPhone(initialData.phone || '');
      setIsEditingPhone(false);
      setPhoneError('');

      setEmail(initialData.email || '');
      setIsEditingEmail(false);
      setEmailError('');

      setAddressData({
        zipcode: initialData.zipcode || '',
        street: initialData.street || '',
        number: initialData.number || '',
        complement: initialData.complement || '',
        neighborhood: initialData.neighborhood || '',
        city: initialData.city || '',
        state: initialData.state || ''
      });
      setIsEditingAddress(false);
      setAddressError('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  // Busca CEP automático se o usuário alterar o endereço
  const handleCepLookup = async (cepValue) => {
    const formatted = maskCEP(cepValue);
    setAddressData((prev) => ({ ...prev, zipcode: formatted }));
    setAddressError('');

    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetchAddressByCEP(clean);
        if (res && !res.erro) {
          setAddressData((prev) => ({
            ...prev,
            street: res.street || prev.street,
            neighborhood: res.neighborhood || prev.neighborhood,
            city: res.city || prev.city,
            state: res.state || prev.state
          }));
        } else {
          setAddressError('CEP não localizado nos Correios.');
        }
      } catch (err) {
        setAddressError('Erro ao consultar CEP.');
      } finally {
        setLoadingCep(false);
      }
    }
  };

  // Avança Etapa 1 (Telefone)
  const handleConfirmPhone = (keepCurrent) => {
    setPhoneError('');
    if (keepCurrent) {
      setIsEditingPhone(false);
      setStep(2);
      return;
    }

    // Se está editando, valida o telefone digitado
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setPhoneError('Por favor, informe um telefone válido com DDD (mínimo 10 dígitos).');
      return;
    }

    setStep(2);
  };

  // Avança Etapa 2 (E-mail)
  const handleConfirmEmail = (keepCurrent) => {
    setEmailError('');
    if (keepCurrent) {
      setIsEditingEmail(false);
      setStep(3);
      return;
    }

    // Se está editando, valida o e-mail digitado
    if (!email || !validateEmail(email)) {
      setEmailError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    setStep(3);
  };

  // Finaliza Etapa 3 (Endereço) e salva todas as alterações
  const handleFinalSubmit = async (keepCurrent) => {
    setAddressError('');

    let finalAddress = { ...addressData };

    if (!keepCurrent) {
      // Validações de endereço
      if (!addressData.zipcode || addressData.zipcode.replace(/\D/g, '').length !== 8) {
        setAddressError('Informe um CEP válido com 8 dígitos.');
        return;
      }
      if (!addressData.street?.trim()) {
        setAddressError('O campo Rua / Logradouro é obrigatório.');
        return;
      }
      if (!addressData.number?.trim()) {
        setAddressError('O campo Número é obrigatório.');
        return;
      }
      if (!addressData.neighborhood?.trim()) {
        setAddressError('O campo Bairro é obrigatório.');
        return;
      }
      if (!addressData.city?.trim()) {
        setAddressError('O campo Cidade é obrigatório.');
        return;
      }
      if (!addressData.state?.trim()) {
        setAddressError('O campo UF é obrigatório.');
        return;
      }
    }

    const payloadToSave = {
      phone,
      email,
      ...finalAddress
    };

    if (onConfirmAndSave) {
      await onConfirmAndSave(payloadToSave);
    }
  };

  const formatFullAddress = (addr) => {
    if (!addr.street && !addr.city) return 'Nenhum endereço cadastrado';
    const parts = [
      addr.street ? `${addr.street}${addr.number ? `, nº ${addr.number}` : ''}` : '',
      addr.complement ? `(${addr.complement})` : '',
      addr.neighborhood ? `Bairro ${addr.neighborhood}` : '',
      addr.city ? `${addr.city}/${addr.state || ''}` : '',
      addr.zipcode ? `CEP ${addr.zipcode}` : ''
    ].filter(Boolean);
    return parts.join(' - ');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Cabeçalho do Modal */}
        <div className="bg-[#1d5b79] text-white p-5 sm:p-6 relative">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="absolute top-5 right-5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Validação Obrigatória de Segurança</span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Confirmação de Dados Cadastrais
          </h3>
          <p className="text-xs text-white/80 mt-1 max-w-md">
            Por política de segurança da Vetline, confirme a exatidão do seu telefone, e-mail e endereço antes de gravar as alterações.
          </p>

          {/* Stepper de Progresso */}
          <div className="mt-5 pt-4 border-t border-white/20 grid grid-cols-3 gap-2 text-center text-xs">
            {/* Step 1: Telefone */}
            <div className="flex items-center gap-1.5 justify-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] transition-colors ${
                step > 1
                  ? 'bg-emerald-400 text-emerald-950'
                  : step === 1
                  ? 'bg-white text-[#1d5b79] ring-2 ring-emerald-300'
                  : 'bg-white/20 text-white'
              }`}>
                {step > 1 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '1'}
              </div>
              <span className={`font-semibold hidden sm:inline ${step === 1 ? 'text-white font-bold' : 'text-white/70'}`}>
                Telefone
              </span>
            </div>

            {/* Step 2: E-mail */}
            <div className="flex items-center gap-1.5 justify-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] transition-colors ${
                step > 2
                  ? 'bg-emerald-400 text-emerald-950'
                  : step === 2
                  ? 'bg-white text-[#1d5b79] ring-2 ring-emerald-300'
                  : 'bg-white/20 text-white'
              }`}>
                {step > 2 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '2'}
              </div>
              <span className={`font-semibold hidden sm:inline ${step === 2 ? 'text-white font-bold' : 'text-white/70'}`}>
                E-mail
              </span>
            </div>

            {/* Step 3: Endereço */}
            <div className="flex items-center gap-1.5 justify-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] transition-colors ${
                step === 3
                  ? 'bg-white text-[#1d5b79] ring-2 ring-emerald-300'
                  : 'bg-white/20 text-white'
              }`}>
                3
              </div>
              <span className={`font-semibold hidden sm:inline ${step === 3 ? 'text-white font-bold' : 'text-white/70'}`}>
                Endereço
              </span>
            </div>
          </div>
        </div>

        {/* Corpo do Modal - Conteúdo por Etapa */}
        <div className="p-6 sm:p-7 space-y-6">

          {/* ========================================================================= */}
          {/* ETAPA 1: VERIFICAÇÃO DE TELEFONE                                          */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center flex-shrink-0 border border-brand-green/20">
                  <Phone className="w-5 h-5 text-[#1d5b79]" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    O telefone / WhatsApp permanece o mesmo?
                  </h4>
                  <p className="text-xs text-slate-500">
                    Usado para notificações de faturamento, rastreamento e contato comercial.
                  </p>
                </div>
              </div>

              {/* Exibição do Telefone Atual */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Telefone cadastrado:
                </span>
                <p className="text-lg font-mono font-bold text-slate-800 flex items-center gap-2">
                  <span>{phone || '(Não informado)'}</span>
                </p>
              </div>

              {/* Se o usuário clicou que NÃO permanece o mesmo */}
              {isEditingPhone ? (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3 animate-in fade-in duration-150">
                  <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Digite o novo Telefone / WhatsApp com DDD:
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => {
                      setPhone(maskPhone(e.target.value));
                      setPhoneError('');
                    }}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-blue-300 bg-white text-base font-mono font-bold text-slate-800 focus:ring-2 focus:ring-[#1d5b79]/40 focus:outline-none"
                  />
                  {phoneError && (
                    <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{phoneError}</span>
                    </p>
                  )}
                  
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPhone(false);
                        setPhone(initialData.phone || '');
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      Cancelar alteração
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmPhone(false)}
                      className="px-4 py-2.5 rounded-xl bg-[#1d5b79] hover:bg-[#144258] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Confirmar Telefone e Avançar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Opções Sim / Não */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(true)}
                    className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Não, desejo alterar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfirmPhone(true)}
                    className="p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sim, permanece o mesmo</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: VERIFICAÇÃO DE E-MAIL                                            */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center flex-shrink-0 border border-brand-green/20">
                  <Mail className="w-5 h-5 text-[#1d5b79]" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    O e-mail principal permanece o mesmo?
                  </h4>
                  <p className="text-xs text-slate-500">
                    Destinado para envio de notas fiscais eletrônicas, boletos e comunicações.
                  </p>
                </div>
              </div>

              {/* Exibição do E-mail Atual */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  E-mail cadastrado:
                </span>
                <p className="text-base sm:text-lg font-bold text-slate-800 break-all flex items-center gap-2">
                  <span>{email || '(Não informado)'}</span>
                </p>
              </div>

              {/* Se o usuário clicou que NÃO permanece o mesmo */}
              {isEditingEmail ? (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3 animate-in fade-in duration-150">
                  <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Digite o novo E-mail:
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value.trim());
                      setEmailError('');
                    }}
                    placeholder="seuemail@exemplo.com.br"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-blue-300 bg-white text-sm sm:text-base font-semibold text-slate-800 focus:ring-2 focus:ring-[#1d5b79]/40 focus:outline-none"
                  />
                  {emailError && (
                    <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{emailError}</span>
                    </p>
                  )}
                  
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingEmail(false);
                        setEmail(initialData.email || '');
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      Cancelar alteração
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmEmail(false)}
                      className="px-4 py-2.5 rounded-xl bg-[#1d5b79] hover:bg-[#144258] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Confirmar E-mail e Avançar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Opções Sim / Não */
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditingEmail(true)}
                      className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>Não, desejo alterar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleConfirmEmail(true)}
                      className="p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Sim, permanece o mesmo</span>
                    </button>
                  </div>

                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 py-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar para etapa de Telefone</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: VERIFICAÇÃO DE ENDEREÇO                                          */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center flex-shrink-0 border border-brand-green/20">
                  <MapPin className="w-5 h-5 text-[#1d5b79]" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    O endereço cadastral permanece o mesmo?
                  </h4>
                  <p className="text-xs text-slate-500">
                    Local de entrega padrão e emissão da Nota Fiscal de faturamento.
                  </p>
                </div>
              </div>

              {/* Exibição do Endereço Atual */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Endereço atual cadastrado:
                </span>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                  {formatFullAddress(addressData)}
                </p>
              </div>

              {/* Se o usuário clicou que NÃO permanece o mesmo */}
              {isEditingAddress ? (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3.5 animate-in fade-in duration-150">
                  <span className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Preencha o novo Endereço:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* CEP */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">CEP *</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={addressData.zipcode}
                          onChange={(e) => handleCepLookup(e.target.value)}
                          placeholder="00000-000"
                          maxLength={9}
                          autoFocus
                          className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-[#1d5b79]/40 focus:outline-none"
                        />
                        {loadingCep && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 absolute right-2.5 top-1/2 -translate-y-1/2" />}
                      </div>
                    </div>

                    {/* Rua */}
                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Logradouro / Rua *</label>
                      <input
                        type="text"
                        value={addressData.street}
                        onChange={(e) => setAddressData((p) => ({ ...p, street: e.target.value }))}
                        placeholder="Rua, Av..."
                        className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1d5b79]/40 focus:outline-none"
                      />
                    </div>

                    {/* Número */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Número *</label>
                      <input
                        type="text"
                        value={addressData.number}
                        onChange={(e) => setAddressData((p) => ({ ...p, number: e.target.value }))}
                        placeholder="123"
                        className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1d5b79]/40 focus:outline-none"
                      />
                    </div>

                    {/* Complemento */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Complemento</label>
                      <input
                        type="text"
                        value={addressData.complement}
                        onChange={(e) => setAddressData((p) => ({ ...p, complement: e.target.value }))}
                        placeholder="Sala, Apto..."
                        className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1d5b79]/40 focus:outline-none"
                      />
                    </div>

                    {/* Bairro */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Bairro *</label>
                      <input
                        type="text"
                        value={addressData.neighborhood}
                        onChange={(e) => setAddressData((p) => ({ ...p, neighborhood: e.target.value }))}
                        placeholder="Bairro"
                        className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1d5b79]/40 focus:outline-none"
                      />
                    </div>

                    {/* Cidade */}
                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Cidade *</label>
                      <input
                        type="text"
                        value={addressData.city}
                        onChange={(e) => setAddressData((p) => ({ ...p, city: e.target.value }))}
                        placeholder="Cidade"
                        className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1d5b79]/40 focus:outline-none"
                      />
                    </div>

                    {/* UF */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">UF *</label>
                      <input
                        type="text"
                        value={addressData.state}
                        onChange={(e) => setAddressData((p) => ({ ...p, state: e.target.value.toUpperCase() }))}
                        maxLength={2}
                        placeholder="SP"
                        className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-xs font-bold text-center text-slate-800 focus:ring-2 focus:ring-[#1d5b79]/40 focus:outline-none"
                      />
                    </div>
                  </div>

                  {addressError && (
                    <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{addressError}</span>
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-blue-200">
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      Cancelar alteração
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleFinalSubmit(false)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Gravando dados...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Confirmar Endereço & Salvar Mudanças</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Opções Sim / Não */
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(true)}
                      className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>Não, desejo alterar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleFinalSubmit(true)}
                      className="p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Salvando tudo...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Sim, salvar mudanças agora</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 py-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar para etapa de E-mail</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
