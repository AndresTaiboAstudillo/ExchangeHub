// El backend guarda códigos ("es", "en"); la interfaz muestra los nombres.
export const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'Inglés' },
  { code: 'fr', label: 'Francés' },
  { code: 'pt', label: 'Portugués' },
  { code: 'de', label: 'Alemán' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: 'Japonés' },
  { code: 'zh', label: 'Chino' },
  { code: 'ko', label: 'Coreano' },
  { code: 'ru', label: 'Ruso' },
  { code: 'ar', label: 'Árabe' },
];

export function languageLabel(code) {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}
