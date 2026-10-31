import { en } from "./en";
import { am } from "./am";
import { om } from "./om";

export type Language = "en" | "am" | "om";

export const dictionaries = {
  en,
  am,
  om,
};

export const languageOptions: Array<{ code: Language; label: string; flag: string; nativeName: string }> = [
  { code: "am", label: "አማርኛ በግዕዝ ፊደላት", flag: "🇪🇹", nativeName: "አማርኛ (ግዕዝ)" },
  { code: "en", label: "Amharic in English letters", flag: "🔤", nativeName: "Amharic (Latin)" },
  { code: "om", label: "Afaan Oromoo", flag: "🇪🇹", nativeName: "Afaan Oromoo" },
];

export { en, am, om };
export type { TranslationDictionary } from "./en";
