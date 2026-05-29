"use client";

import Header from "@/components/navigation/Header";
import TimelineSection from "../components/timeline/TimelineSection";
import SectionTitle from "@/components/SectionTitle";
import Image from "next/image";
import Gallery from "@/components/Gallery";
import { useState } from "react";

export default function Home() {
  const [, setSelectedTimeline] = useState<string | null>(null);
  return (
    <>
      <Header />
      <section
        id="histoire"
        className="relative bg-black text-white py-32 px-6 overflow-hidden"
      >
        {/* Background glow */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-cyan-500 blur-[180px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          {/* Section title */}
          <div className="text-center mb-24">
            <p className="text-cyan-300 uppercase tracking-[0.4em] text-sm mb-6">
              Histoire
            </p>

            <h1 className="text-white text-3xl md:text-5xl xl:text-6xl font-light uppercase tracking-[0.15em] leading-[1.2] drop-shadow-2xl">
              {" "}
              Plombières à
              <br />
              travers le temps
            </h1>

            <p className="mt-8 max-w-3xl mx-auto text-gray-400 text-lg leading-relaxed">
              Découvrez les villages, les bâtiments historiques, les paysages et
              les habitants de la commune de Plombières à travers des archives
              photographiques anciennes et contemporaines.
            </p>
          </div>

          {/* Timeline cards */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Card 1 */}
            <div className="group bg-white/5 border border-white/10 overflow-hidden backdrop-blur-md hover:bg-white/10 hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(34,211,238,0.15)] transition-all duration-500">
              <div className="relative h-64 overflow-hidden">
                <Image
                  src="/images/mine.jpg"
                  alt="Mine du Bleyberg"
                  fill
                  loading="eager"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />

                <div className="absolute inset-0 bg-black/20" />

                <div className="absolute bottom-4 left-4">
                  <p className="text-cyan-300 text-sm uppercase tracking-[0.3em]">
                    1856 — 1922
                  </p>
                </div>
              </div>

              <div className="p-8">
                <SectionTitle>L’exploitation minière</SectionTitle>

                <p className="mt-6 text-gray-400 leading-relaxed text-balance">
                  L’essor industriel du plomb et du zinc transforme profondément
                  la région. Les mines du Bleyberg attirent une importante
                  activité économique avant leur fermeture définitive en 1922.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="group bg-white/5 border border-white/10 overflow-hidden backdrop-blur-md hover:bg-white/10 hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(34,211,238,0.15)] transition-all duration-500">
              <div className="relative h-64 overflow-hidden">
                <Image
                  src="/images/viaduc.jpeg"
                  alt="Viaduc de Moresnet"
                  fill
                  loading="eager"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />

                <div className="absolute inset-0 bg-black/10" />

                <div className="absolute bottom-4 left-4">
                  <p className="text-cyan-300 text-sm uppercase tracking-[0.3em]">
                    1915 — 1916
                  </p>
                </div>
              </div>

              <div className="p-8">
                <SectionTitle>Le Viaduc de Moresnet</SectionTitle>

                <p className="mt-6 text-gray-400 leading-relaxed text-balance">
                  Construit durant la Première Guerre mondiale, le viaduc
                  devient un ouvrage stratégique majeur et reste aujourd’hui un
                  symbole architectural de la commune.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="group bg-white/5 border border-white/10 overflow-hidden backdrop-blur-md hover:bg-white/10 hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(34,211,238,0.15)] transition-all duration-500">
              <div className="relative h-64 overflow-hidden">
                <Image
                  src="/images/commune.jpg"
                  alt="Fusion des communes"
                  fill
                  loading="eager"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />

                <div className="absolute inset-0 bg-black/20" />

                <div className="absolute bottom-4 left-4">
                  <p className="text-cyan-300 text-sm uppercase tracking-[0.3em]">
                    1977
                  </p>
                </div>
              </div>

              <div className="p-8">
                <SectionTitle>La naissance de Plombières</SectionTitle>

                <p className="mt-6 text-gray-400 leading-relaxed text-balance">
                  La fusion des anciennes communes de la région donne naissance
                  à l’entité actuelle de Plombières et réunit ses villages sous
                  une même identité communale.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Gallery />
      <main className="min-h-screen bg-black text-white overflow-x-hidden">
        <TimelineSection setSelectedTimeline={setSelectedTimeline} />
      </main>
    </>
  );
}
