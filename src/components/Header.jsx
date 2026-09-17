import React from 'react';
import { ShieldCheck, Phone, Lock } from 'lucide-react';
import logoImg from '../assets/vetline-logo.png';

export const Header = ({ onNavigateToAdmin }) => {
  return (
    <header className="w-full bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
        {/* Logo Oficial Vetline */}
        <div className="flex items-center space-x-3">
          <img
            src={logoImg}
            alt="Vetline Logo"
            className="h-10 sm:h-12 w-auto object-contain transition-transform duration-200 hover:scale-[1.02]"
          />
          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:inline-block">
            Portal de Cadastro
          </span>
        </div>

        {/* Informações de Suporte, Segurança e Acesso Admin */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-brand-green" />
            <span>Ambiente 100% Seguro</span>
          </div>

          <a
            href="https://wa.me/5500000000000?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20d%C3%BAvidas%20sobre%20o%20cadastro%20na%20Vetline"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-brand-green-light hover:text-brand-teal-dark hover:border-brand-green transition-all border border-slate-200"
          >
            <Phone className="w-3.5 h-3.5 text-brand-teal" />
            <span className="hidden xs:inline">Dúvidas?</span>
            <span>Fale Conosco</span>
          </a>
        </div>
      </div>
    </header>
  );
};
