/**
 * Shared Utilities for Translation and Text Processing
 */
export const SUSPICIOUS_PT_TERMS_FOR_ES = [
  "navegacao",
  "configuracoes",
  "informacoes",
  "chave",
  "cores",
  "pagina inicial",
  "politica de privacidade",
  "termos de servico",
  "proximo",
];

/**
 * Normalizes a string for translation lookup.
...

 * - Trims whitespace
 * - Collapses multiple spaces
 * - Removes smart quotes and other non-standard punctuation
 * - (Optional) Removes trailing punctuation for more flexible matches
 */
export function normalizeTranslationKey(text: string): string {
  if (!text) return "";

  // 1. Basic cleaning
  let normalized = text.trim().replace(/\s+/g, " ");

  // 2. Smart punctuation mapping
  const SMART_PUNCTUATION_MAP: Record<string, string> = {
    "\u2018": "'",
    "\u2019": "'",
    "\u201C": "\"",
    "\u201D": "\"",
    "\u2013": "-",
    "\u2014": "-",
    "\u2026": "...",
    "\u00A0": " ",
  };

  for (const [input, output] of Object.entries(SMART_PUNCTUATION_MAP)) {
    normalized = normalized.split(input).join(output);
  }

  // 3. Remove trailing punctuation to match "Start" with "Start!" or "Start."
  // Note: We only do this for the lookup key, not the displayed text.
  normalized = normalized.replace(/[.!?]+$/g, "").trim();

  return normalized;
}

/**
 * Normalizes text for comparison (e.g. checking if API returned original text)
 * - Lowercase
 * - Remove diacritics (accents)
 * - Remove non-alphanumeric characters
 */
export function normalizeForComparison(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Checks if a token is likely an acronym (no translation needed)
 */
export function isAcronymToken(text: string): boolean {
  const compact = text.trim();
  return /^[A-Z0-9_-]+$/.test(compact) && compact.length <= 6;
}

/**
 * Heuristic to detect if a translation response is just the source text returned.
 */
export function isLikelyUntranslatedSource(
  sourceText: string,
  translatedText: string,
  targetLanguage: string
): boolean {
  if (targetLanguage === "en") return false;

  const source = sourceText.trim();
  const translated = translatedText.trim();
  
  if (!source || !translated) return false;
  if (!/[A-Za-z]/.test(source)) return false;
  if (isAcronymToken(source)) return false;

  return normalizeForComparison(source) === normalizeForComparison(translated);
}
