import NavBar from "@/components/navigation/NavBar";
import HomeHero from "@/components/HomeHero";

export default function Home() {
  return (
    <>
      <NavBar />
      <HomeHero />
      <main className="min-h-screen bg-black text-white overflow-x-hidden">
        <section className="relative bg-black text-white py-32 px-6 overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-150 bg-cyan-500 blur-[160px]" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <p className="text-cyan-300 uppercase tracking-[0.4em] text-sm mb-6">
              Archives photographiques
            </p>

            <h2 className="text-white text-3xl md:text-5xl font-light uppercase tracking-[0.15em] leading-[1.2]">
              Plombières en images
            </h2>

            <p className="mt-8 max-w-2xl mx-auto text-white/50 text-lg leading-relaxed">
              Explorez les photographies anciennes et contemporaines de la commune.
              Parcourez la galerie ou localisez les clichés sur la carte interactive.
            </p>

            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
              <a
                href="/galerie"
                className="px-8 py-4 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.3em] text-sm hover:bg-cyan-300/20 hover:border-cyan-300/70 transition-all duration-300 min-h-11 flex items-center"
              >
                Galerie
              </a>
              <a
                href="/carte"
                className="px-8 py-4 rounded-full border border-white/20 bg-white/5 text-white uppercase tracking-[0.3em] text-sm hover:bg-white/10 hover:border-white/40 transition-all duration-300 min-h-11 flex items-center"
              >
                Carte interactive
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
