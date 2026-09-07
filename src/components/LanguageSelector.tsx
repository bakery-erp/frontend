'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Language } from '@/locales';
import { Globe, Check, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'header' | 'sidebar' | 'pill';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { language, setLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption = languages.find((l) => l.code === language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (langCode: Language) => {
    setLanguage(langCode);
    setIsOpen(false);
  };

  if (variant === 'sidebar') {
    return (
      <div className={`px-2 py-1.5 ${className}`}>
        <label className="text-[11px] font-bold text-[#CBB29F] uppercase tracking-wider mb-2 flex items-center gap-1.5 px-2">
          <Globe className="w-3.5 h-3.5 text-[#E87A18]" />
          <span>Language / ቋንቋ / Afaan</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5 bg-[#3D2314] p-1.5 rounded-xl border border-[#5A3A23]">
          {languages.map((item) => {
            const isSelected = item.code === language;
            return (
              <button
                key={item.code}
                onClick={() => handleSelect(item.code)}
                type="button"
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-[#E87A18] text-white shadow-md'
                    : 'text-[#CBB29F] hover:text-white hover:bg-[#5A3A23]'
                }`}
                title={item.nativeName}
              >
                <span className="text-sm">{item.flag}</span>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full">
                  {item.code === 'en' ? 'EN' : item.code === 'am' ? 'አማ' : 'OM'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Header Dropdown variant (standard)
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-[#F4ECE1] hover:bg-[#EAE0D1] text-[#2C1B10] border border-[#E0D5C3] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="text-sm sm:text-base leading-none">{activeOption.flag}</span>
        <span className="hidden sm:inline font-bold tracking-tight">{activeOption.nativeName}</span>
        <span className="sm:hidden font-bold">{activeOption.code.toUpperCase()}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#8C7361] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-2xl bg-white shadow-xl border border-[#EDE4D5] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          role="menu"
        >
          <div className="px-3 py-1.5 text-[11px] font-bold text-[#8C7361] uppercase tracking-wider border-b border-[#F4ECE1] mb-1">
            Select Language
          </div>
          {languages.map((item) => {
            const isSelected = item.code === language;
            return (
              <button
                key={item.code}
                onClick={() => handleSelect(item.code)}
                type="button"
                className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs sm:text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-[#FAF7EE] text-[#E87A18] font-bold'
                    : 'text-[#2C1B10] hover:bg-[#FAF7EE] hover:text-[#E87A18]'
                }`}
                role="menuitem"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{item.flag}</span>
                  <div>
                    <div className="font-bold leading-tight">{item.nativeName}</div>
                    <div className="text-[10px] text-[#8C7361] font-normal leading-tight">{item.label}</div>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#E87A18] stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
