"use client";

import { useState } from "react";
import Image from "next/image";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="relative h-screen w-full overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/images/header-bg.png"
            alt="Plombières"
            fill
            priority
            loading="eager"
            className="object-cover animate-slowZoom"
          />

          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/55" />
        </div>

        {/* Top navigation */}
        <div className="fixed top-0 left-0 w-full z-50 backdrop-blur-xl bg-black/50 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-10">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <Image
                src="/images/logo-white.png"
                alt="Plombières en Images"
                width={0}
                height={0}
                loading="eager"
                sizes="100vw"
                className="w-[130px] md:w-[190px] lg:w-[280px] xl:w-[320px] h-auto drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]"
              />
            </div>

            {/* Desktop menu */}
            <nav className="hidden md:flex items-center gap-12 ml-10 text-sm uppercase tracking-[0.2em] text-white">
              {" "}
              <a
                href="#"
                className="hover:text-cyan-300 transition-all duration-300"
              >
                Accueil
              </a>
              <a
                href="#"
                className="hover:text-cyan-300 transition-all duration-300"
              >
                Archives
              </a>
              <a
                href="#histoire"
                className="hover:text-cyan-300 transition-all duration-300"
              >
                Histoire
              </a>
              <a
                href="#"
                className="hover:text-cyan-300 transition-all duration-300"
              >
                Carte
              </a>
              <a
                href="#"
                className="hover:text-cyan-300 transition-all duration-300"
              >
                Collections
              </a>
            </nav>

            {/* Mobile button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white text-3xl z-50"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-20 flex items-center justify-center min-h-screen pt-32 text-center px-6">
          <div className="max-w-4xl animate-fadeInUp">
            <p className="text-cyan-300 uppercase tracking-[0.45em] text-sm md:text-base mb-6">
              Archives photographiques
            </p>

            <h1 className="text-white text-3xl md:text-5xl xl:text-6xl font-light uppercase tracking-[0.15em] leading-[1.2] drop-shadow-2xl">
              {" "}
              Les images d’hier
              <br />
              et d’aujourd’hui
            </h1>

            <p className="mt-8 text-gray-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Un espace dédié aux photographies anciennes et actuelles de la
              commune de Plombières afin de préserver, partager et transmettre
              la mémoire visuelle de ses villages.
            </p>

            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
              <a
                href="#histoire"
                className="px-8 py-4 bg-white/10 border border-white/20 backdrop-blur-md text-white uppercase tracking-[0.25em] text-sm hover:bg-white hover:text-black transition-all duration-500"
              >
                Découvrir
              </a>

              <a
                href="#"
                className="px-8 py-4 border border-cyan-300/40 text-cyan-200 uppercase tracking-[0.25em] text-sm hover:bg-cyan-300 hover:text-black transition-all duration-500"
              >
                Explorer les archives
              </a>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-black/95 backdrop-blur-xl z-40">
            <div className="flex flex-col items-center justify-center min-h-screen pt-32 gap-10 text-white text-2xl uppercase tracking-widest">
              <a
                href="#"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-cyan-300 transition-all duration-300"
              >
                Accueil
              </a>

              <a
                href="#"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-cyan-300 transition-all duration-300"
              >
                Archives
              </a>

              <a
                href="#histoire"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-cyan-300 transition-all duration-300"
              >
                Histoire
              </a>

              <a
                href="#"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-cyan-300 transition-all duration-300"
              >
                Carte
              </a>

              <a
                href="#"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-cyan-300 transition-all duration-300"
              >
                Collections
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
//fin
