/**
 * Access to the curated example sessions shipped in `sessions/`.
 * `sessions/index.json` is generated at build time by scripts/session-index.js.
 */
import $ from "jquery";

export const SESSIONS_PATH = "sessions/";
export const INDEX_FILE = "index.json";

export function fetchExampleIndex() {
    return $.getJSON(SESSIONS_PATH + INDEX_FILE);
}

export function fetchExample(file) {
    return $.getJSON(SESSIONS_PATH + file);
}

/** URL for the current page that preloads the given example, keeping other params. */
export function preloadUrl(file, location = window.location) {
    const params = new URLSearchParams(location.search);
    params.set("preload", file);
    return `${location.pathname}?${params.toString()}${location.hash || ""}`;
}
