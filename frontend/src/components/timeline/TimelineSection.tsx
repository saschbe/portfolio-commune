export default function TimelineSection() {
  const years = [
    {
      year: "1882",
      detail: "Fin de L'âge d'or\nindustriel du Bleyberg",
    },
    {
      year: "1916",
      detail: "Construction du\nViaduc de Moresnet",
    },
    {
      year: "1944",
      detail: "La Libération",
    },
    {
      year: "1977",
      detail: "Fusion des\nCommunes",
    },
    {
      year: "2019",
      detail: "Un siècle sous\nle nom de Plombières",
    },
  ];

  return (
    <section
      id="histoire"
      className="relative py-24 bg-gradient-to-b from-black to-zinc-950 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Titre */}
        <div className="mb-16 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Histoire de Plombières
          </h2>

          <p className="text-gray-400 text-lg">
            Voyagez à travers les époques du village.
          </p>
        </div>

        {/* Mobile arrows */}
        <div className="flex md:hidden justify-between items-center mb-2 px-6 text-cyan-300 animate-pulse">
          <span className="text-2xl">←</span>

          <span className="text-sm tracking-widest uppercase opacity-70">
            Faites glisser
          </span>

          <span className="text-2xl">→</span>
        </div>

        {/* Timeline */}
        <div className="overflow-x-auto relative z-0 scrollbar-hide">
          <div className="relative min-w-[900px] py-10">
            {/* Ligne */}
            <div className="absolute top-[52px] left-0 w-full h-[2px] bg-cyan-400/70" />

            {/* Années */}
            <div className="flex justify-between relative z-10">
              {years.map((item) => (
                <div
                  key={item.year}
                  className="flex flex-col items-center min-w-[120px] group cursor-pointer"
                >
                  {/* Point */}
                  <div className="w-6 h-6 rounded-full bg-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.9)] group-hover:scale-125 transition-transform duration-300" />

                  {/* Année */}
                  <span className="mt-6 text-white text-2xl tracking-widest group-hover:text-cyan-300 transition-colors duration-300">
                    {item.year}
                  </span>
                  <p className="mt-3 text-sm text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center max-w-[140px] whitespace-pre-line">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
