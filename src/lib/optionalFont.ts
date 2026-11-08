export type OptionalFontState = "checking" | "available" | "downloading" | "ready" | "error";

const CACHE = "webreader-optional-fonts-v1";
const FILE = "fonts/LXGWWenKai-Regular-v1.530.woff2";
const SHA256 = "81112edef5daa14ecd5706a59707fa61265d0261b4906f995ef1b6f05fbddf62";
let state: OptionalFontState = "checking";
let fontUrl: string | undefined;
let operation: Promise<void> | undefined;
const listeners = new Set<() => void>();
const publish = (next: OptionalFontState) => { state = next; for (const listener of listeners) listener(); };
export const getOptionalFontState = () => state;
export const subscribeOptionalFont = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const assetUrl = () => new URL(`${import.meta.env.BASE_URL}${FILE}`, document.baseURI).href;

async function activate(response: Response): Promise<void> {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== 8098872) throw new Error("Invalid font length");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== SHA256) throw new Error("Invalid font digest");
  const face = await new FontFace("WebReader WenKai", bytes, { weight: "400", style: "normal" }).load();
  document.fonts.add(face);
  fontUrl = URL.createObjectURL(new Blob([bytes], { type: "font/woff2" }));
}

// Cache inspection never fetches the optional asset. A shared operation also
// prevents StrictMode mounts and repeated clicks from duplicating downloads.
export function initializeOptionalFont(): Promise<void> {
  if (operation) return operation;
  if (state !== "checking") return Promise.resolve();
  operation = (async () => {
    try {
      const cache = await caches.open(CACHE);
      const response = await cache.match(assetUrl());
      if (!response) { publish("available"); return; }
      try { await activate(response); publish("ready"); }
      catch { await cache.delete(assetUrl()); publish("available"); }
    } catch { publish("available"); }
  })().finally(() => { operation = undefined; });
  return operation;
}

export function downloadOptionalFont(): Promise<void> {
  if (operation) return operation;
  if (state === "ready") return Promise.resolve();
  publish("downloading");
  operation = (async () => {
    try {
      const response = await fetch(assetUrl(), { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error("Font download failed");
      // Persist only complete, verified, browser-decodable font bytes.
      const bytes = await response.arrayBuffer();
      await activate(new Response(bytes));
      try { await (await caches.open(CACHE)).put(assetUrl(), new Response(bytes, { headers: { "Content-Type": "font/woff2" } })); }
      catch {
        if (fontUrl) URL.revokeObjectURL(fontUrl);
        fontUrl = undefined;
        document.fonts.forEach((face) => { if (face.family === "WebReader WenKai") document.fonts.delete(face); });
        throw new Error("Font storage failed");
      }
      publish("ready");
    } catch { publish("error"); }
  })().finally(() => { operation = undefined; });
  return operation;
}

export function optionalFontStyles(): string {
  return fontUrl ? `@font-face { font-family: "WebReader WenKai"; src: url("${fontUrl}") format("woff2"); font-style: normal; font-weight: 400; font-display: block; }` : "";
}
