"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PhotosSection from "./_components/PhotosSection";
import UsersSection from "./_components/UsersSection";
import PendingSection from "./_components/PendingSection";

type Section = "photos" | "pending" | "users";

const navItems: { id: Section; label: string }[] = [
  { id: "photos", label: "Photos" },
  { id: "pending", label: "En attente d'approbation" },
  { id: "users", label: "Utilisateurs" },
];

export default function AdminPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("photos");
  const [pendingCount, setPendingCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function navigate(section: Section) {
    setActiveSection(section);
    setMobileOpen(false);
  }

  const sidebarLinks = navItems.map(({ id, label }) => (
    <button
      key={id}
      onClick={() => navigate(id)}
      className={`relative text-left w-full px-4 py-3 rounded-xl text-sm uppercase tracking-[0.2em] transition-all duration-200 ${
        activeSection === id
          ? "bg-cyan-300/10 text-cyan-300 border border-cyan-300/20"
          : "text-white/50 hover:text-white/80 hover:bg-white/5"
      }`}
    >
      {label}
      {id === "pending" && pendingCount > 0 && (
        <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-cyan-300 text-black text-[10px] font-bold">
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      )}
    </button>
  ));

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-white/10 sticky top-0 h-screen overflow-y-auto py-8 px-4">
        <div className="mb-10">
          <p className="text-cyan-300 uppercase tracking-[0.4em] text-xs mb-1">
            Administration
          </p>
          <p className="text-white/30 uppercase tracking-[0.15em] text-xs">
            Plombières en Images
          </p>
        </div>

        <nav className="flex flex-col gap-1 flex-1">{sidebarLinks}</nav>

        <button
          onClick={handleLogout}
          className="text-left px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/25 hover:text-white/50 transition-colors"
        >
          Déconnexion
        </button>
      </aside>

      {/* Header — mobile */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 bg-black/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-5 py-3">
        <p className="text-cyan-300 uppercase tracking-[0.35em] text-xs">Admin</p>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-white/50 hover:text-white text-xl leading-none"
          aria-label="Menu"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* Overlay — mobile */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black pt-14 px-5 flex flex-col">
          <nav className="flex flex-col gap-1 pt-6 flex-1">{sidebarLinks}</nav>
          <button
            onClick={handleLogout}
            className="py-5 text-xs uppercase tracking-[0.2em] text-white/25 hover:text-white/50 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-5 py-8 md:px-10 pt-20 md:pt-8">
        {activeSection === "photos" && <PhotosSection />}
        {activeSection === "users" && <UsersSection />}
        {activeSection === "pending" && (
          <PendingSection onCountChange={setPendingCount} />
        )}
      </main>
    </div>
  );
}
