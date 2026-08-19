import { installCSSRandomPolyfill } from "./polyfill.js";

function autoInstall() {
  const globalScope = typeof window !== "undefined" ? window : globalThis;
  if (!globalScope || !globalScope.document) {
    return;
  }

  if (globalScope.document.readyState === "loading") {
    globalScope.document.addEventListener("DOMContentLoaded", () => {
      installCSSRandomPolyfill({ window: globalScope });
    }, { once: true });
    return;
  }

  installCSSRandomPolyfill({ window: globalScope });
}

if (typeof globalThis !== "undefined") {
  globalThis.installCSSRandomPolyfill = installCSSRandomPolyfill;
}

autoInstall();

export { installCSSRandomPolyfill };
