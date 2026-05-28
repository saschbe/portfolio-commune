"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const MapClient = dynamic(() => import("@/components/MapClient"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <p className="text-white/30 uppercase tracking-[0.35em] text-xs">
        Chargement de la carte…
      </p>
    </div>
  ),
});

export default function CartePage() {
  return (
    <div className="h-screen w-full relative overflow-hidden bg-black">
      {/* Map — plein écran */}
      <MapClient />

      {/* Header — superposé en position absolue */}
      <header className="absolute top-0 left-0 right-0 z-1000 flex items-center justify-between px-6 py-4 bg-black/70 backdrop-blur-md border-b border-white/10">
        {/* Gauche : retour + titre */}
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="text-white/30 hover:text-white/60 transition-colors text-xs uppercase tracking-[0.3em]"
          >
            ← Retour
          </Link>
          <span className="text-white/10 hidden sm:block">|</span>
          <div className="hidden sm:block">
            <p className="text-cyan-300 uppercase tracking-[0.4em] text-xs mb-0.5">
              Plombières en Images
            </p>
            <h1 className="text-white text-sm font-light uppercase tracking-[0.25em]">
              Carte de Plombières
            </h1>
          </div>
        </div>

        {/* Droite : légende */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.6)]" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              Lieu historique
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              Photo archivée
            </span>
          </div>
        </div>
      </header>
    </div>
  );
}
