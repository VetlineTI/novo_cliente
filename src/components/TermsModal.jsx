import React from 'react';
import { X, FileText, CheckCircle, ShieldCheck } from 'lucide-react';

export const TermsModal = ({ isOpen, onClose, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho do Modal */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-brand-green flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Termos e Condições de Entrega</h2>
              <p className="text-xs text-slate-500">Vetline Distribuidora de Produtos Veterinários</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo dos Termos com scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <section className="space-y-1.5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-brand-green" />
              1. Entregas em Endereço Divergente do CNPJ/CPF
            </h3>
            <p>
              A Vetline realiza entregas em endereços diferentes daquele constante no comprovante de residência ou cartão do CNPJ, desde que o endereço seja devidamente informado neste cadastro e validado por nossa equipe de conformidade fiscal e regulatória.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-slate-800 text-sm">
              2. Documentação e Validação Técnica
            </h3>
            <p>
              Medicamentos controlados, biológicos e vacinas veterinárias exigem conformidade com as normas do MAPA (Ministério da Agricultura e Pecuária) e do CRMV. É responsabilidade do cliente fornecer dados verídicos e manter seu responsável técnico atualizado.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-slate-800 text-sm">
              3. Recebimento de Produtos Refrigerados
            </h3>
            <p>
              Para itens da cadeia de frio (2°C a 8°C), o local de entrega informado deve contar com pessoa autorizada e equipamento adequado para a conferência e armazenamento imediato no ato da entrega.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-slate-800 text-sm">
              4. Privacidade e Proteção de Dados (LGPD)
            </h3>
            <p>
              Seus dados cadastrais e documentos anexados são tratados de forma confidencial e utilizados unicamente para validação cadastral, faturamento e entrega de mercadorias pela Vetline.
            </p>
          </section>
        </div>

        {/* Rodapé com Ações */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-100 transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              if (onAccept) onAccept();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-green text-white font-semibold text-xs sm:text-sm hover:bg-emerald-600 shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Li e Concordo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
