import { useEffect, useRef } from "react";

type RefreshFn = () => Promise<unknown> | unknown;

// The handler registered by the page that is currently open (if any).
// The shared header's refresh icon calls it; pages that don't register one
// get the default refresh defined in the header.
let currentPageRefresh: RefreshFn | null = null;

export function getPageRefresh(): RefreshFn | null {
    return currentPageRefresh;
}

/** Lets a page define what the header refresh icon re-fetches while it is open. */
export function usePageRefresh(fn: RefreshFn) {
    const ref = useRef(fn);
    ref.current = fn;
    useEffect(() => {
        const handler: RefreshFn = () => ref.current();
        currentPageRefresh = handler;
        return () => {
            if (currentPageRefresh === handler) currentPageRefresh = null;
        };
    }, []);
}