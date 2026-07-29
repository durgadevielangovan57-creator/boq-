
import { Product } from "./store";

// Helper to normalize string for comparison
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const norm = (s: any) => String(s || "").toUpperCase();

export const getEstimatorTypeFromProduct = (product: Product | any): string | null => {
    if (!product) return null;

    const subcat = norm(product.subcategory || product.subcategory_name);
    const cat = norm(product.category || product.category_name);
    const name = norm(product.name);

    // 1. DOORS (Existing logic + keywords)
    if (
        subcat.includes("DOOR") ||
        cat.includes("DOOR") ||
        name.includes("DOOR") ||
        subcat.includes("VISION PANEL") || // Specific door part
        (subcat === "WPC" && name.includes("FRAME")) || // WPC Frames are often doors
        subcat.includes("FLUSH") ||
        subcat.includes("TEAK") ||
        subcat.includes("STILE")
    ) {
        return "doors";
    }

    // 2. CIVIL / WALL
    if (
        subcat.includes("CIVIL") ||
        cat.includes("CIVIL") ||
        subcat.includes("WALL") ||
        cat.includes("WALL") ||
        subcat.includes("CEMENT") ||
        subcat.includes("BRICK") ||
        subcat.includes("SAND")
    ) {
        return "civilwall";
    }

    // 3. ELECTRICAL
    if (
        subcat.includes("ELECTRICAL") ||
        cat.includes("ELECTRICAL") ||
        subcat.includes("WIRE") ||
        subcat.includes("CABLE") ||
        subcat.includes("SWITCH") ||
        subcat.includes("SOCKET") ||
        subcat.includes("LIGHT") ||
        subcat.includes("LED") ||
        subcat.includes("FAN") ||
        subcat.includes("MCB") ||
        subcat.includes("CONDUIT")
    ) {
        return "electrical";
    }

    // 4. FLOORING
    if (
        subcat.includes("FLOOR") ||
        cat.includes("FLOOR") ||
        subcat.includes("TILE") ||
        subcat.includes("MARBLE") ||
        subcat.includes("GRANITE") ||
        name.includes("FLOORING")
    ) {
        return "flooring";
    }

    // 5. PLUMBING
    if (
        subcat.includes("PLUMB") ||
        cat.includes("PLUMB") ||
        subcat.includes("PIPE") ||
        cat.includes("PIPE") ||
        subcat.includes("WATER") || // e.g. Water Tank
        subcat.includes("TAP") ||
        subcat.includes("FAUCET") ||
        subcat.includes("SINK")
    ) {
        return "plumbing";
    }

    // 6. PAINTING
    if (
        subcat.includes("PAINT") ||
        cat.includes("PAINT") ||
        subcat.includes("PUTTY") ||
        subcat.includes("PRIMER") ||
        subcat.includes("EMULSION")
    ) {
        return "painting";
    }

    // 7. FALSE CEILING
    if (
        subcat.includes("CEILING") ||
        cat.includes("CEILING") ||
        subcat.includes("GYPSUM") ||
        subcat.includes("POP") ||
        subcat.includes("GRID")
    ) {
        return "falseceiling";
    }

    // 8. DYNAMIC FALLBACK
    // If no specific keyword is found, return a normalized version of the KEY
    // taking the first word of subcategory/category as a candidate
    const candidate = (subcat || cat || name).trim();
    if (candidate) {
        // normalize by removing spaces/hyphens
        const normalized = candidate.replace(/[-\s]/g, "");
        // if normalized contains any letters/numbers, assume it's a valid estimator key
        if (/\w+/.test(normalized)) return normalized.toLowerCase();
    }

    return null;
};
