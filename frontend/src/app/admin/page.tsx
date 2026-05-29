"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PhotosSection from "./_components/PhotosSection";
import UsersSection from "./_components/UsersSection";
import PendingSection from "./_components/PendingSection";
import LieuxSection from "./_components/LieuxSection";
import SignalementsSection from "./_components/SignalementsSection";

type Section = "photos" | "lieux" | "pending" | "users" | "signalements";

const navItems: { id: Section; label: string }[] = [
  { id: "photos", label: "Photos" },
  { id: "lieux", label: "Lieux" },
  { id: "pending", label: "En attente d'approbation" },
  { id: "users", label: "Utilisateurs" },
  { id: "signalements", label: "Signalements" },
];

export default function AdminPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("photos");
  const [pendingCount, setPendingCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<string>("");
  const [notifNewPhoto, setNotifNewPhoto] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count ?? 0));

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("profiles")
        .select("role, notif_new_photo")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile) {
            setCurrentRole(profile.role ?? "");
            setNotifNewPhoto(profile.notif_new_photo ?? false);
          }
        });
    });
  }, []);

  async function handleNotifToggle(value: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingNotif(true);
    setNotifNewPhoto(value);
    await supabase
      .from("profiles")
      .update({ notif_new_photo: value })
      .eq("id", user.id);
    setSavingNotif(false);
  }

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

        <nav className="flex flex-col gap-1 flex-1">
          <Link
            href="/"
            className="text-left px-4 py-3 rounded-xl text-sm uppercase tracking-[0.2em] text-white/50 hover:text-white/80 hover:bg-white/5 transition-all duration-200"
          >
            ← Retour au site
          </Link>
          {sidebarLinks}
        </nav>

        {currentRole === "moderator" && (
          <div className="mb-3 pt-4 border-t border-white/5">
            <p className="px-4 text-[10px] uppercase tracking-[0.25em] text-white/25 mb-3">
              Préférences
            </p>
            <div className="flex items-center justify-between gap-2 px-4 py-2">
              <p className="text-xs text-white/45 leading-tight">
                Notif. nouvelles photos
              </p>
              <button
                onClick={() => handleNotifToggle(!notifNewPhoto)}
                disabled={savingNotif}
                aria-label="Activer les notifications"
                className={`relative shrink-0 w-9 h-5 rounded-full transition-all duration-300 disabled:opacity-50 ${
                  notifNewPhoto ? "bg-cyan-300/80" : "bg-white/10"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${
                    notifNewPhoto ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

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
          <nav className="flex flex-col gap-1 pt-6 flex-1">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="text-left px-4 py-3 rounded-xl text-sm uppercase tracking-[0.2em] text-white/50 hover:text-white/80 hover:bg-white/5 transition-all duration-200"
            >
              ← Retour au site
            </Link>
            {sidebarLinks}
          </nav>
          {currentRole === "moderator" && (
            <div className="mb-3 pt-4 border-t border-white/5">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/25 mb-3">
                Préférences
              </p>
              <div className="flex items-center justify-between gap-2 py-2">
                <p className="text-xs text-white/45 leading-tight">
                  Notif. nouvelles photos
                </p>
                <button
                  onClick={() => handleNotifToggle(!notifNewPhoto)}
                  disabled={savingNotif}
                  aria-label="Activer les notifications"
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-all duration-300 disabled:opacity-50 ${
                    notifNewPhoto ? "bg-cyan-300/80" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${
                      notifNewPhoto ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
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
        {activeSection === "lieux" && <LieuxSection />}
        {activeSection === "users" && <UsersSection />}
        {activeSection === "pending" && (
          <PendingSection onCountChange={setPendingCount} />
        )}
        {activeSection === "signalements" && <SignalementsSection />}
      </main>
    </div>
  );
}
