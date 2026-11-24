import { useEffect, useState } from "react";
import apiFetch from "@/lib/api";
import { hasFormatting } from "@/lib/richDescription";

/**
 * Talks to /api/rich-text (new, additive). Keeps a small in-memory cache and
 * batches lookups so a page with many descriptions makes ONE request.
 */

const squash = (s: string) => String(s || "").replace(/\s+/g, " ").trim();

const cache = new Map<string, string | null>(); // squashed plain text -> rich html | null
const waiting = new Map<string, Array<(v: string | null) => void>>();
const listeners = new Map<string, Set<(v: string | null) => void>>();
let timer: ReturnType<typeof setTimeout> | null = null;
const originals = new Map<string, string>(); // squashed -> a real text to send

function notify(key: string, v: string | null) {
    listeners.get(key)?.forEach((fn) => fn(v));
}

async function flush() {
    timer = null;
    const keys = Array.from(waiting.keys());
    if (keys.length === 0) return;
    const batch = new Map(keys.map((k) => [k, waiting.get(k)!]));
    keys.forEach((k) => waiting.delete(k));
    try {
        for (let i = 0; i < keys.length; i += 400) {
            const slice = keys.slice(i, i + 400);
            const resp = await apiFetch("/api/rich-text/lookup", {
                method: "POST",
                body: JSON.stringify({ texts: slice.map((k) => originals.get(k) || k) }),
            });
            if (!resp.ok) throw new Error(String(resp.status));
            const data = await resp.json();
            slice.forEach((k, idx) => {
                if (!cache.has(k)) cache.set(k, (data.results?.[idx] ?? null) as string | null);
                const v = cache.get(k) ?? null; // a save that finished meanwhile wins
                batch.get(k)!.forEach((cb) => cb(v));
            });
        }
    } catch {
        // feature simply shows plain text; nothing is cached so it retries next time
        keys.forEach((k) => batch.get(k)!.forEach((cb) => cb(null)));
    }
}

/** Formatting stored for this description text (or null). */
export function getRich(plain: string): Promise<string | null> {
    const key = squash(plain);
    if (!key) return Promise.resolve(null);
    if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
    return new Promise((resolve) => {
        originals.set(key, plain);
        const list = waiting.get(key) || [];
        list.push(resolve);
        waiting.set(key, list);
        if (!timer) timer = setTimeout(flush, 30);
    });
}

/** Save (or clear) the formatting for a description text. Returns what is now stored. */
export async function saveRich(plain: string, rich: string): Promise<string | null> {
    const key = squash(plain);
    if (!key) return null;
    const wants = hasFormatting(rich);
    // Nothing to do if there was no formatting and none is wanted.
    if (!wants && cache.has(key) && cache.get(key) === null) return null;
    try {
        const resp = await apiFetch("/api/rich-text", {
            method: "PUT",
            body: JSON.stringify({ plain, rich: wants ? rich : "" }),
        });
        if (!resp.ok) return cache.get(key) ?? null;
        const data = await resp.json();
        const v = data.saved ? (data.rich as string) : null;
        cache.set(key, v);
        notify(key, v);
        return v;
    } catch {
        return cache.get(key) ?? null;
    }
}

/** Formatting for a description text, kept up to date. `enabled=false` pauses lookups (e.g. while typing). */
export function useRichFor(plain: string, enabled = true): string | null {
    const key = squash(plain);
    const [rich, setRich] = useState<string | null>(cache.has(key) ? cache.get(key) ?? null : null);

    useEffect(() => {
        if (!enabled) return;
        if (!key) { setRich(null); return; }
        let alive = true;
        if (cache.has(key)) setRich(cache.get(key) ?? null);
        else getRich(plain).then((v) => alive && setRich(v));
        const set = listeners.get(key) || new Set();
        const fn = (v: string | null) => alive && setRich(v);
        set.add(fn);
        listeners.set(key, set);
        return () => { alive = false; set.delete(fn); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, enabled]);

    return rich;
}