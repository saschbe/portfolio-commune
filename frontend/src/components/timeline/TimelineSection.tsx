export default function TimelineSection() {
  const years = ["1900", "1920", "1950", "1980", "2000", "2026"];

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

        {/* Timeline */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="relative min-w-[900px] py-10">
            {/* Ligne */}
            <div className="absolute top-[52px] left-0 w-full h-[2px] bg-cyan-400/70" />

            {/* Années */}
            <div className="flex justify-between relative z-10">
              {years.map((year) => (
                <div
                  key={year}
                  className="flex flex-col items-center min-w-[120px] group cursor-pointer"
                >
                  {/* Point */}
                  <div className="w-6 h-6 rounded-full bg-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.9)] group-hover:scale-125 transition-transform duration-300" />

                  {/* Année */}
                  <span className="mt-6 text-white text-2xl tracking-widest group-hover:text-cyan-300 transition-colors duration-300">
                    {year}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
