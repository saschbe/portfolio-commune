"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true)
  );
}

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setInstalled(isStandalone());
    });

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }

    setShowIosHint(true);
  }

  if (installed) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={installApp}
        className="px-8 py-4 rounded-full border border-white/20 bg-black/45 text-white uppercase tracking-[0.3em] text-sm hover:bg-white/10 hover:border-white/40 transition-all duration-300"
      >
        Installer l&apos;app
      </button>
      {showIosHint && (
        <p className="absolute left-1/2 top-full mt-3 w-64 -translate-x-1/2 text-center text-[11px] leading-relaxed text-white/55">
          Ouvrez le menu du navigateur, puis ajoutez le site à l&apos;écran
          d&apos;accueil.
        </p>
      )}
    </div>
  );
}
