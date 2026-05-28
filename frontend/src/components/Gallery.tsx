"use client";

import { useState } from "react";
import Image from "next/image";

const filters = [
  "Tous",
  "Plombières",
  "Gemmenich",
  "Hombourg",
  "Moresnet",
  "Montzen",
  "Sippenaeken",
];

const images = [
  {
    src: "/images/mine.jpg",
    title: "Mine du Bleyberg",
    village: "Plombières",
    year: "1902",
    timeline: "1902",
    type: "Photo ancienne",
    restored: true,
    description:
      "Photographie des anciennes installations minières du Bleyberg durant l’âge d’or industriel du zinc et du plomb.",
  },

  {
    src: "/images/viaduc.jpeg",
    title: "Viaduc de Moresnet",
    village: "Moresnet",
    year: "1916",
    timeline: "1916",
    type: "Archive historique",
    restored: false,
    description:
      "Construction du viaduc stratégique durant la Première Guerre mondiale.",
  },

  {
    src: "/images/commune.jpg",
    title: "Ancienne commune",
    village: "Montzen",
    year: "1977",
    timeline: "1977",
    type: "Document communal",
    restored: false,
    description:
      "Fusion des anciennes communes donnant naissance à l’entité actuelle de Plombières.",
  },
];

export default function Gallery({
  selectedTimeline,
  setSelectedTimeline,
}: {
  selectedTimeline: string | null;
  setSelectedTimeline: (value: string | null) => void;
}) {
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [showInfo, setShowInfo] = useState(true);

  const filteredImages = images.filter((image) => {
    const villageMatch =
      activeFilter === "Tous" || image.village === activeFilter;

    const timelineMatch =
      activeFilter === "Tous"
        ? true
        : !selectedTimeline || image.timeline === selectedTimeline;

    return villageMatch && timelineMatch;
  });

  return (
    <section
      id="archives"
      className="relative bg-black text-white py-16 px-6 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        {/* Title */}
        <div className="text-center mb-16">
          <p className="text-cyan-300 uppercase tracking-[0.4em] text-sm mb-6">
            Galerie
          </p>

          <h2 className="text-2xl md:text-5xl xl:text-6xl font-light uppercase tracking-[0.15em] leading-[1.2]">
            Les images d’hier
            <br />
            et d’aujourd’hui
          </h2>
        </div>

        {/* Filters */}
        <div className="flex md:flex-wrap md:justify-center gap-3 mb-12 overflow-x-auto md:overflow-visible scrollbar-hide pb-2 px-1">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => {
                if (filter === "Tous") {
                  setSelectedTimeline(null);
                }

                setActiveFilter(filter);
              }}
              className={`px-4 py-2 shrink-0 text-xs md:text-sm uppercase tracking-[0.25em] border rounded-full transition-all duration-300   
             ${
               activeFilter === filter
                 ? "bg-cyan-300/90 text-black border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                 : "border-white/10 bg-white/5 hover:bg-white/10"
             }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredImages.map((image, index) => (
            <div
              key={index}
              onClick={() => {
                setSelectedImage(image);
                setShowInfo(true);
              }}
              className="group relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md  transition-all duration-700 hover:-translate-y-2 hover:border-cyan-300/30 hover:bg-white/[0.05] hover:shadow-[0_20px_80px_rgba(34,211,238,0.12)] "
            >
              <div
                className={`relative ${index % 3 === 0 ? "min-h-[520px]" : index % 2 === 0 ? "min-h-[420px]" : "min-h-[340px]"}`}
              >
                <Image
                  src={image.src}
                  alt={image.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-all duration-[2000ms] ease-out group-hover:scale-110 group-hover:brightness-110"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-all duration-700" />
              </div>

              <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/90 to-transparent">
                <h3 className="text-xl uppercase tracking-[0.08em]">
                  {image.title}
                </h3>

                <p className="text-cyan-300 text-sm uppercase tracking-[0.2em] mt-2">
                  {image.village}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Fullscreen viewer */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl">
          <div
            className="absolute inset-0"
            onClick={() => setSelectedImage(null)}
          />

          <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-black via-zinc-950 to-black">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(null);
              }}
              className="absolute top-6 right-6 z-[110] text-white text-5xl hover:text-cyan-300 transition-all duration-300"
            >
              ✕
            </button>

            <div
              className="relative w-screen h-[100dvh] md:max-w-6xl md:h-[85vh]"
              onClick={(e) => {
                e.stopPropagation();
                setShowInfo(!showInfo);
              }}
            >
              <Image
                src={selectedImage.src}
                alt={selectedImage.title}
                fill
                sizes="100vw"
                className="object-contain select-none animate-[fadeIn_0.8s_ease]"
              />
            </div>

            <div className="absolute top-6 left-6 z-[120] text-white/60 text-sm uppercase tracking-[0.3em]">
              {String(
                images.findIndex((img) => img.src === selectedImage.src) + 1,
              ).padStart(2, "0")}{" "}
              / {String(images.length).padStart(2, "0")}
            </div>

            {showInfo && (
              <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 max-w-xl bg-black/30 backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.45)] transition-all duration-700">
                <h3 className="text-3xl md:text-5xl font-light uppercase tracking-[0.14em] text-white leading-tight">
                  {selectedImage.title}
                </h3>

                <div className="mt-3 text-cyan-300 uppercase tracking-[0.2em]">
                  {selectedImage.village}
                </div>

                <p className="mt-2 text-gray-400 leading-relaxed max-w-prose">
                  {selectedImage.description}
                </p>

                <div className="mt-6 flex flex-wrap gap-4">
                  <span className="px-4 py-2 bg-white/10 border border-white/10 text-sm uppercase tracking-[0.15em]">
                    {selectedImage.year}
                  </span>

                  <span className="px-4 py-2 bg-white/10 border border-white/10 text-sm uppercase tracking-[0.15em]">
                    {selectedImage.type}
                  </span>

                  {selectedImage.restored && (
                    <span className="px-4 py-2 bg-cyan-300 text-black text-sm uppercase tracking-[0.15em]">
                      Photo restaurée
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
