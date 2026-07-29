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
