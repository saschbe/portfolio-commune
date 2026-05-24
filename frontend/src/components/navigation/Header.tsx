"use client";

import { useState } from "react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50">
        <div className="backdrop-blur-md bg-black/30 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            {/* Logo */}
            <div className="text-white font-bold tracking-widest text-lg md:text-xl">
              <img
                src="/logo.png"
                alt="Plombières en Images"
                className="h-10 w-auto"
              />
            </div>

            {/* Desktop menu */}
            <nav className="hidden md:flex items-center gap-8 text-sm uppercase tracking-wide text-gray-200">
              <a
                href="#"
                className="hover:text-cyan-300 transition-colors duration-300"
              >
                Accueil
              </a>

              <a
                href="#"
                className="hover:text-cyan-300 transition-colors duration-300"
              >
                Archives
              </a>

              <a
                href="#histoire"
                className="hover:text-cyan-300 transition-colors duration-300"
              >
                Histoire
              </a>

              <a
                href="#"
                className="hover:text-cyan-300 transition-colors duration-300"
              >
                Carte
              </a>

              <a
                href="#"
                className="hover:text-cyan-300 transition-colors duration-300"
              >
                Collections
              </a>
            </nav>

            {/* Mobile button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white text-3xl active:scale-90 transition-transform duration-200"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-40 animate-fadeIn flex flex-col items-center justify-center gap-10 text-white text-2xl uppercase tracking-widest">
          <a
            href="#"
            onClick={() => setMobileMenuOpen(false)}
            className="active:scale-85 transition-all duration-200"
          >
            Accueil
          </a>

          <a
            href="#"
            onClick={() => setMobileMenuOpen(false)}
            className="active:scale-85 transition-all duration-200"
          >
            Archives
          </a>

          <a
            href="#histoire"
            onClick={() => setMobileMenuOpen(false)}
            className="active:scale-85 transition-all duration-200"
          >
            Histoire
          </a>

          <a
            href="#"
            onClick={() => setMobileMenuOpen(false)}
            className="active:scale-85 transition-all duration-200"
          >
            Carte
          </a>

          <a
            href="#"
            onClick={() => setMobileMenuOpen(false)}
            className="active:scale-85 transition-all duration-200"
          >
            Collections
          </a>
        </div>
      )}
    </>
  );
}
