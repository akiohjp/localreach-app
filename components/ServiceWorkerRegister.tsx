"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js) so the app is installable
 * and the shell works offline. No-ops during development and where service
 * workers are unsupported (e.g. iOS private mode, older browsers).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Registration failure must never break the app — just log it.
        console.error("[sw] registration failed", err);
      });
    };

    // Wait for the page to settle so the SW install doesn't compete with
    // first paint / hydration.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
