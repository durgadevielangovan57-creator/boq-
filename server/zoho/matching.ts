/**
 * =====================================================================
 * SAFE NAME / PHONE NORMALIZATION HELPERS
 * ---------------------------------------------------------------------
 * These are intentionally NOT fuzzy-matching (no edit-distance / Levenshtein
 * / similarity scoring). They only account for harmless, mechanical
 * differences: punctuation, extra whitespace, letter case, and common
 * legal-entity suffixes ("Ltd", "Pvt", "Limited", ...). Two names are only
 * ever treated as "the same" if they become byte-identical after this
 * normalization - anything looser is left as an ambiguous/no-match case so
 * the caller can fall back to manual mapping instead of guessing.
 * =====================================================================
 */

// Legal-entity suffix words that commonly differ between how a vendor is
// typed in BOQ vs how it is registered in Zoho Books, without changing
// which company is actually meant (e.g. "Ltd" vs "Limited").
const COMPANY_SUFFIX_WORDS = new Set([
    "ltd",
    "limited",
    "pvt",
    "private",
    "inc",
    "incorporated",
    "corp",
    "corporation",
    "llp",
    "llc",
    "co",
    "company",
]);

/**
 * Normalizes a company/vendor name for strict-but-punctuation/spacing/
 * suffix-insensitive comparison. Strips punctuation, lowercases, drops
 * common legal-entity suffix words, and removes all whitespace so that
 * "3 M India Ltd", "3M India Ltd" and "3 M India Limited" all collapse to
 * the same key ("3mindia"). Distinct companies with genuinely different
 * words will still normalize to different keys.
 */
export function normalizeCompanyNameKey(raw: string | null | undefined): string {
    if (!raw) return "";
    const cleaned = raw
        .toLowerCase()
        .replace(/[.,&()/\\'"-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!cleaned) return "";

    const words = cleaned.split(" ").filter(Boolean);

    // Only strip suffix words from the end, and only if something meaningful
    // remains - never strip down to nothing (that would make two unrelated
    // "Ltd"-only fragments match).
    while (
        words.length > 1 &&
        COMPANY_SUFFIX_WORDS.has(words[words.length - 1])
    ) {
        words.pop();
    }

    return words.join("");
}

/** True only if both names normalize to the same, non-empty key. */
export function companyNamesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    const ka = normalizeCompanyNameKey(a);
    const kb = normalizeCompanyNameKey(b);
    return Boolean(ka) && ka === kb;
}

/**
 * Picks the best word to use as a search query against Zoho's "contains"
 * text search, so we get reasonable recall even when BOQ/Zoho spell the
 * name slightly differently. Prefers the longest word that is not a
 * company suffix, ignoring very short (<=1 char) tokens.
 */
export function pickSearchToken(raw: string | null | undefined): string {
    if (!raw) return "";
    const words = raw
        .toLowerCase()
        .replace(/[.,&()/\\'"-]/g, " ")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 1 && !COMPANY_SUFFIX_WORDS.has(w));

    if (words.length === 0) return raw.trim();

    words.sort((x, y) => y.length - x.length);
    return words[0];
}

/** Keeps only digits, then the last `n` of them (so country codes / leading
 * zeros don't cause an otherwise-identical phone number to fail to match). */
export function lastDigits(raw: string | null | undefined, n = 10): string {
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    return digits.length > n ? digits.slice(-n) : digits;
}

/** True only if both values have at least `n` digits in common at the end. */
export function phoneNumbersMatch(a: string | null | undefined, b: string | null | undefined, n = 10): boolean {
    const da = lastDigits(a, n);
    const db = lastDigits(b, n);
    return Boolean(da) && da.length >= 7 && da === db;
}