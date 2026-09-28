'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { dictionaries, Language, languageOptions, en } from '../locales';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (keyPath: string, variables?: Record<string, string | number>) => string;
  languages: typeof languageOptions;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'bakery_erp_lang';

// Helper to resolve nested keys like "dashboard.todayRevenueTitle"
function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr == null || typeof curr !== 'object') return undefined;
    curr = curr[part];
  }
  return typeof curr === 'string' ? curr : undefined;
}

// Humanizes a developer key like "production.statusProduction" or "colStockStatus" into "Production" or "Stock Status"
function humanizeKey(keyPath: string): string {
  if (!keyPath) return '';
  const parts = keyPath.split('.');
  const last = parts[parts.length - 1] || keyPath;

  // Strip common technical prefixes if followed by an uppercase letter
  const stripped = last.replace(/^(status|col|lbl|btn|nav|tab|filter|modal|toast|field|step)([A-Z])/, '$2');

  // Insert spaces between camelCase words and replace dashes/underscores
  const withSpaces = stripped
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!withSpaces) return '';
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language;
      if (saved && (saved === 'en' || saved === 'am' || saved === 'om')) {
        setLanguageState(saved);
      }
    } catch (e) {
      console.warn('Failed to read language preference from localStorage:', e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      console.warn('Failed to save language preference to localStorage:', e);
    }
  };

  const t = useMemo(() => {
    return (keyPath: string, variables?: Record<string, string | number>): string => {
      const dict = dictionaries[language] || dictionaries.en;
      let text = getNestedValue(dict, keyPath);

      // Fallback to English if translation is missing in selected language
      if (text === undefined && language !== 'en') {
        text = getNestedValue(dictionaries.en, keyPath);
      }

      // If still missing, convert key to a clean human-readable label so raw keys NEVER show on the UI
      if (text === undefined) {
        let fallback = humanizeKey(keyPath);
        if (variables) {
          Object.entries(variables).forEach(([key, val]) => {
            fallback = fallback.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
          });
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[i18n missing key] "${keyPath}" -> "${fallback}"`);
        }
        return fallback;
      }

      // Interpolate variables like {name}, {count}, {branch}
      if (variables) {
        Object.entries(variables).forEach(([key, val]) => {
          text = text!.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
        });
      }

      return text;
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: languageOptions }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function useTranslation() {
  const { t, language, setLanguage, languages } = useLanguage();
  return { t, language, setLanguage, languages };
}
