import Image from "next/image";

export default function HomeHero() {
  return (
    <section id="accueil" className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/header-bg.png"
          alt="Plombières"
          fill
          priority
          loading="eager"
          className="object-cover animate-slowZoom"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-20 flex items-center justify-center min-h-screen pt-32 text-center px-6">
        <div className="max-w-4xl animate-fadeInUp">
          <p className="text-cyan-300 uppercase tracking-[0.45em] text-sm md:text-base mb-6">
            Archives photographiques
          </p>
          <h1 className="text-white text-3xl md:text-5xl xl:text-6xl font-light uppercase tracking-[0.15em] leading-[1.2] drop-shadow-2xl">
            Les images d&apos;hier
            <br />
            et d&apos;aujourd&apos;hui
          </h1>
          <p className="mt-8 text-gray-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Un espace dédié aux photographies anciennes et actuelles de la
            commune de Plombières afin de préserver, partager et transmettre
            la mémoire visuelle de ses villages.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
            <a
              href="/galerie"
              className="px-8 py-4 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.3em] text-sm hover:bg-cyan-300/20 hover:border-cyan-300/70 transition-all duration-300"
            >
              Explorer les archives
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
