import React from 'react';
import { ShieldCheck, Check, Sparkles, Building2 } from 'lucide-react';

export const LeftSidebar = () => {
  return (
    <div className="w-full lg:max-w-md xl:max-w-lg lg:sticky lg:top-24 flex flex-col justify-between space-y-8 py-2">
      {/* Bloco Principal de Apresentação */}
      <div className="space-y-6">
        
        {/* Tag de destaque com as cores do logo */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-green-light border border-brand-green/40 text-brand-dark text-xs font-semibold shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-brand-green" />
          <span className="text-slate-800">Credenciamento Oficial de Clientes</span>
        </div>

        {/* Título Principal com destaque verde da marca */}
        <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
          Seja um <span className="text-brand-green font-black inline-block">cliente Vetline</span>
        </h1>

        {/* Textos explicativos */}
        <div className="space-y-3 text-slate-600">
          <p className="text-base sm:text-lg font-medium text-slate-800">
            Preencha o formulário ao lado e envie seus documentos.
          </p>
          <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
            Nossa equipe analisará suas informações e entrará em contato em breve para liberar sua tabela exclusiva e condições comerciais.
          </p>
        </div>

        {/* Lista de Vantagens / Benefícios */}
        <div className="space-y-6 pt-4">
          {/* Benefício 1 */}
          <div className="flex items-start gap-4 group">
            <div className="flex-shrink-0 w-11 h-11 rounded-full border-2 border-brand-green flex items-center justify-center text-brand-green bg-brand-green-light group-hover:bg-brand-green group-hover:text-white transition-all duration-200">
              <Check className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-base">
                Processo simples e rápido
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Preencha seus dados e envie os documentos necessários.
              </p>
            </div>
          </div>

          {/* Benefício 2 */}
          <div className="flex items-start gap-4 group">
            <div className="flex-shrink-0 w-11 h-11 rounded-full border-2 border-brand-green flex items-center justify-center text-brand-green bg-brand-green-light group-hover:bg-brand-green group-hover:text-white transition-all duration-200">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-base">
                Segurança e conformidade
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Seus dados estão protegidos e seguimos todas as normas de segurança e LGPD.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cartão de credibilidade / Rodapé do Sidebar */}
      <div className="pt-6 border-t border-slate-200/80 hidden lg:block">
        <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-teal-light text-brand-teal flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-slate-700">Atendimento em todo o território nacional</p>
            <p className="text-slate-400">Logística ágil e entrega refrigerada certificada</p>
          </div>
        </div>
      </div>
    </div>
  );
};
