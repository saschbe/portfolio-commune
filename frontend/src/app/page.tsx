"use client";

import Header from "@/components/navigation/Header";
import TimelineSection from "../components/timeline/TimelineSection";

export default function Home() {
  return (
    <>
      <Header />

      <main className="min-h-screen bg-black text-white overflow-x-hidden">
        <section className="relative flex items-center justify-center min-h-screen px-6">
          {/* Background overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black z-0" />

          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop')",
            }}
          />

          {/* Content */}
          <div className="relative z-10 text-center max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-wide mb-8">
              PLOMBIÈRES EN IMAGES
            </h1>

            <p className="text-xl md:text-3xl text-gray-200 leading-relaxed mb-12 font-light">
              “La photographie est la mémoire du monde.
              <br />
              <br />
              Et un village sans images
              <br />
              est un village qui oublie son histoire.”
            </p>

            <button className="px-8 py-4 border border-cyan-400 text-cyan-300 rounded-full text-lg hover:bg-cyan-400 hover:text-black transition-all duration-300">
              Explorer l’histoire
            </button>
          </div>
        </section>
        <TimelineSection />
      </main>
    </>
  );
}
