export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* Grille de fond subtile */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Contenu centré */}
      <div className="relative z-10 text-center max-w-lg">

        {/* Logo */}
        <div className="mb-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-white.png"
            alt="Plombières en Images"
            className="h-16 mx-auto opacity-90"
          />
        </div>

        {/* Titre */}
        <p className="text-[10px] uppercase tracking-[0.5em] text-cyan-300 mb-6">
          En construction
        </p>

        <h1 className="font-serif text-4xl md:text-5xl font-light text-white leading-tight mb-8">
          Plombières<br />
          <em className="italic text-white/40">en Images</em>
        </h1>

        {/* Séparateur */}
        <div className="w-8 h-px bg-cyan-300/40 mx-auto mb-8" />

        {/* Message */}
        <p className="text-white/40 text-sm uppercase tracking-[0.2em] leading-relaxed mb-12">
          Le site des archives photographiques<br />
          de la commune de Plombières<br />
          est en cours de construction.
        </p>

        {/* Email contact */}
        <a
          href="mailto:contact@photoplombieres.eu"
          className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-white/10 bg-white/5 text-white/40 text-[11px] uppercase tracking-[0.25em] hover:border-cyan-300/30 hover:text-cyan-300/70 transition-all duration-300"
        >
          <span>→</span>
          contact@photoplombieres.eu
        </a>

        {/* URL */}
        <p className="mt-12 text-white/15 text-[10px] uppercase tracking-[0.3em]">
          www.photoplombieres.eu
        </p>
      </div>
    </div>
  );
}
