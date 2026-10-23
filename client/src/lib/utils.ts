import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Common industry synonyms for better search relevance
 */
const SYNONYMS: Record<string, string[]> = {
  "ss": ["stainless", "steel"],
  "gi": ["galvanized", "iron"],
  "ms": ["mild", "steel"],
  "pvc": ["polyvinyl", "chloride"],
  "sqft": ["square", "feet", "sft"],
  "sft": ["square", "feet", "sqft"],
  "sqmt": ["square", "meter", "sqmt"],
  "rft": ["running", "feet"],
  "rmt": ["running", "meter"],
  "alu": ["aluminium"],
  "ply": ["plywood"],
  "glass": ["mirror", "glazing"],
  "stone": ["granite", "marble", "quartz"],
  "granite": ["stone"],
  "marble": ["stone"],
  "tile": ["ceramic", "vitrified", "flooring"],
  "paint": ["varnish", "coating", "emulsion"],
  "wire": ["cable", "electrical"],
  "cable": ["wire", "electrical"],
  "tap": ["faucet", "plumbing", "cock"],
  "faucet": ["tap", "plumbing"],
  "door": ["shutter", "entry"],
  "lock": ["handle", "hardware", "latch"],
  "handle": ["hardware", "knob"],
};

/**
 * Expands a query with related terms
 */
function expandQuery(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const expanded = [...words];

  words.forEach(word => {
    if (SYNONYMS[word]) {
      expanded.push(...SYNONYMS[word]);
    }
    // Also check if any synonym key contains the word
    Object.entries(SYNONYMS).forEach(([key, synonyms]) => {
      if (synonyms.includes(word)) {
        expanded.push(key);
      }
    });
  });

  return Array.from(new Set(expanded));
}

/**
 * Fuzzy search that handles partial matches, multi-keyword search, and related terms.
 * Returns true if the item matches the query.
 */
export function fuzzySearch(query: string, textToSearch: string | string[]): boolean {
  if (!query) return true;

  const expandedWords = expandQuery(query);
  const searchableText = (Array.isArray(textToSearch) ? textToSearch.join(" ") : (textToSearch || "")).toLowerCase();

  // Scoring: Check if ALL original words or their expanded versions are present
  // For better "any match" behavior, we can check if at least one original word matches or most expanded words match.
  // The user asked for "return all relevant results", "dynamically filter results that contain or are closely related".

  const originalWords = query.toLowerCase().split(/\s+/).filter(Boolean);

  // Basic strategy: Every original word must have a match (either exact, partial, or via synonym)
  return originalWords.every(word => {
    // 1. Check partial match of the word itself
    // For very short queries (1-2 chars), use a more restrictive 'starts with' or whole word check
    if (word.length <= 2) {
      const wordsInText = searchableText.split(/[^a-z0-9]/).filter(Boolean);
      if (wordsInText.some(w => w.startsWith(word))) return true;
    } else {
      if (searchableText.includes(word)) return true;
    }

    // 2. Check synonyms/related terms
    const synonyms = SYNONYMS[word] || [];
    if (synonyms.some(syn => searchableText.includes(syn))) return true;

    return false;
  });
}

/* ------------------------------------------------------------------ */
/* smartSearch - stricter / friendlier search used by the Admin lists  */
/* (Materials, Shops, ...). fuzzySearch above is left untouched.       */
/* ------------------------------------------------------------------ */

type NormalizedText = { hay: string; compact: string; words: string[] };
const NORMALIZE_CACHE = new Map<string, NormalizedText>();

/** lower-case, drop quotes, turn separators into spaces, keep decimals (12.5) */
function normalizeForSearch(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/["'’‘”“`]/g, "")
    .replace(/[^a-z0-9.\s]/g, " ")        // - _ / , ( ) x-separators etc. -> space
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")  // keep dots only between digits
    .replace(/\s+/g, " ")
    .trim();
}

function getNormalized(text: string): NormalizedText {
  const cached = NORMALIZE_CACHE.get(text);
  if (cached) return cached;
  const hay = normalizeForSearch(text);
  const entry = { hay, compact: hay.replace(/\s+/g, ""), words: hay.split(" ").filter(Boolean) };
  if (NORMALIZE_CACHE.size > 30000) NORMALIZE_CACHE.clear(); // keep memory bounded
  NORMALIZE_CACHE.set(text, entry);
  return entry;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** true if a and b differ by at most one insertion / deletion / substitution */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

function matchesWord(word: string, n: NormalizedText): boolean {
  // 1. Numbers ("8", "12.5"): must be a whole number, so "8" matches 8mm / 8x4 / 8 mm
  //    but NOT 80, 18mm or 0.8.
  if (/^\d+(\.\d+)?$/.test(word)) {
    return new RegExp(`(?<![\\d.])${escapeRegExp(word)}(?!\\d|\\.\\d)`).test(n.hay);
  }

  // 2. Number + unit / size ("8mm", "12.5mm", "8x4"): spaces in the data are ignored
  //    ("12.5 mm" matches "12.5mm"), and the number must start at a boundary (18mm != 8mm).
  if (/\d/.test(word)) {
    return new RegExp(`(?<![\\d.])${escapeRegExp(word)}`).test(n.compact);
  }

  // 3. Very short words ("ss", "gi"): start of a word only, or a known abbreviation
  if (word.length <= 2) {
    if (n.words.some((w) => w.startsWith(word))) return true;
    // unit right after a number: "8 mm" finds "8mm", "5 m" finds "5m"
    if (new RegExp(`(?<=\\d)${escapeRegExp(word)}(?![a-z])`).test(n.hay)) return true;
  } else {
    // 4. Normal words: plain contains (also across spaces: "gypsumboard")
    if (n.hay.includes(word) || n.compact.includes(word)) return true;
  }

  // 5. Related terms (ss -> stainless, ply -> plywood ...)
  const syn = SYNONYMS[word];
  if (syn && syn.some((s) => n.hay.includes(s))) return true;

  // 6. Small typo tolerance for longer words ("gypsm" -> gypsum)
  if (word.length >= 5) {
    for (const w of n.words) {
      if (w.length >= 4 && w[0] === word[0] && withinOneEdit(word, w)) return true;
    }
  }
  return false;
}

/**
 * Every word typed must be found. Works across several fields at once.
 *  - "gypsum"        -> everything containing gypsum
 *  - "gypsum 8"      -> gypsum items with a size of exactly 8 (8mm, 8x4, 8 mm) - not 80 / 18 / 0.8
 *  - "gypsum 12.5mm" -> also finds "12.5 mm"
 *  - "gypsum board 8x4" -> also finds 8'x4'
 *  - "gypsm"         -> small typos still find gypsum
 */
export function smartSearch(query: string, textToSearch: string | string[]): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  const text = Array.isArray(textToSearch) ? textToSearch.filter(Boolean).join(" ") : (textToSearch || "");
  const n = getNormalized(text);
  return q.split(" ").every((word) => matchesWord(word, n));
}

/**
 * Relevance score for ordering results (higher = better). Only meant to be
 * used on items that already passed smartSearch.
 */
export function smartSearchScore(query: string, primaryText: string): number {
  const q = normalizeForSearch(query);
  if (!q) return 0;
  const words = q.split(" ");
  const n = getNormalized(primaryText || "");
  let score = 0;
  if (n.hay === q) score += 100;
  if (n.hay.startsWith(words[0])) score += 30;
  for (const w of words) {
    if (n.words.includes(w)) score += 10;            // whole word
    else if (n.words.some((x) => x.startsWith(w))) score += 5; // word prefix
    else if (n.hay.includes(w)) score += 2;          // somewhere inside
  }
  // shorter names are usually the more "direct" match
  score -= Math.min(n.hay.length, 120) / 120;
  return score;
}