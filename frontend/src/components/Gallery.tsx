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
    type: "Document communal",
    restored: false,
    description:
      "Fusion des anciennes communes donnant naissance à l’entité actuelle de Plombières.",
  },
];

export default function Gallery() {
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [showInfo, setShowInfo] = useState(true);

  const filteredImages =
    activeFilter === "Tous"
      ? images
      : images.filter((image) => image.village === activeFilter);

  return (
    <section
      id="archives"
      className="relative bg-black text-white py-32 px-6 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        {/* Title */}
        <div className="text-center mb-16">
          <p className="text-cyan-300 uppercase tracking-[0.4em] text-sm mb-6">
            Galerie
          </p>

          <h2 className="text-2xl md:text-3xl md:text-5xl xl:text-6xl font-light uppercase tracking-[0.15em] leading-[1.2]">
            Les images d’hier
            <br />
            et d’aujourd’hui
          </h2>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-5 py-3 uppercase tracking-[0.2em] text-sm border transition-all duration-300
              ${
                activeFilter === filter
                  ? "bg-cyan-300 text-black border-cyan-300"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Gallery */}
        <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6">
          {filteredImages.map((image, index) => (
            <div
              key={index}
              onClick={() => {
                setSelectedImage(image);
                setShowInfo(true);
              }}
              className="group relative overflow-hidden bg-white/5 border border-white/10 break-inside-avoid"
            >
              <div className="relative min-h-[300px]">
                <Image
                  src={image.src}
                  alt={image.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />

                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all duration-500" />
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

          <div className="relative flex items-center justify-center w-full h-full md:p-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(null);
              }}
              className="absolute top-6 right-6 z-[110] text-white text-5xl hover:text-cyan-300 transition-all duration-300"
            >
              ✕
            </button>

            <div className="relative w-full h-full md:max-w-6xl md:h-[85vh]">
              <Image
                src={selectedImage.src}
                alt={selectedImage.title}
                fill
                sizes="100vw"
                className="object-contain select-none"
              />
            </div>

            {showInfo && (
              <div className="absolute bottom-8 left-8 max-w-xl bg-black/50 backdrop-blur-md border border-white/10 p-6 rounded-xl">
                <h3 className="text-2xl md:text-3xl uppercase tracking-[0.1em] text-white">
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
