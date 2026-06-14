"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import NavBar from "@/components/navigation/NavBar";
import { Turnstile } from "@marsidev/react-turnstile";
import { imageUrl } from "@/lib/imageUrl";
import { resizeImage } from "@/lib/resizeImage";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import PhotoTypeSelector from "@/components/PhotoTypeSelector";

const LocationPicker = dynamic(
  () => import("@/components/LocationPicker"),
  { ssr: false, loading: () => <div className="w-full h-50 rounded-xl border border-white/10 bg-white/5 animate-pulse" /> }
);

const villages = [
  "Plombières",
  "Gemmenich",
  "Hombourg",
  "Moresnet",
  "Montzen",
  "Sippenaeken",
];

type PhotoStatus = "pending" | "approved" | "rejected" | null;

type Photo = {
  id: string;
  src: string;
  title: string;
  village: string;
  year: string;
  description: string;
  type: string;
  restored: boolean;
  status: PhotoStatus;
  created_at: string;
};

type FormState = {
  title: string;
  village: string;
  year: string;
  description: string;
  type: string;
  restored: boolean;
  file: File | null;
  latitude: string;
  longitude: string;
};

const defaultForm: FormState = {
  title: "",
  village: villages[0],
  year: "",
  description: "",
  type: "",
  restored: false,
  file: null,
  latitude: "",
  longitude: "",
};

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/7 transition-all duration-200";
const labelClass =
  "block text-xs uppercase tracking-[0.25em] text-white/50 mb-2";

function StatusBadge({ status }: { status: PhotoStatus }) {
  if (status === "pending")
    return (
      <span className="px-2.5 py-1 rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-300 text-[10px] uppercase tracking-[0.2em]">
        En attente
      </span>
    );
  if (status === "approved")
    return (
      <span className="px-2.5 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 text-[10px] uppercase tracking-[0.2em]">
        Approuvée
      </span>
    );
  if (status === "rejected")
    return (
      <span className="px-2.5 py-1 rounded-full border border-red-400/30 bg-red-400/10 text-red-400 text-[10px] uppercase tracking-[0.2em]">
        Rejetée
      </span>
    );
  return (
    <span className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-white/40 text-[10px] uppercase tracking-[0.2em]">
      Publiée
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("user");
  const [notifNewPhoto, setNotifNewPhoto] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      loadPhotos(data.user.id);
      supabase
        .from("profiles")
        .select("role, notif_new_photo")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile, error }) => {
          if (error) return;
          if (profile) {
            setRole(profile.role ?? "user");
            setNotifNewPhoto(profile.notif_new_photo ?? false);
          }
        });
    });
  }, [router]);

  async function loadPhotos(userId: string) {
    const { data } = await supabase
      .from("photos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setPhotos(data ?? []);
    setLoadingPhotos(false);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!form.file || !user) return;

    if (!turnstileToken) {
      setSubmitError("Veuillez compléter la vérification anti-spam.");
      setSubmitStatus("error");
      return;
    }

    setSubmitStatus("loading");
    setSubmitError("");

    const verifyRes = await fetch("/api/verify-turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: turnstileToken }),
    });
    if (!verifyRes.ok) {
      setSubmitError("Vérification anti-spam échouée. Réessayez.");
      setSubmitStatus("error");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      return;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if ((recentCount ?? 0) >= 5) {
      setSubmitError("Limite atteinte : vous ne pouvez pas soumettre plus de 5 photos par heure.");
      setSubmitStatus("error");
      return;
    }

    const uuid = crypto.randomUUID();
    const ext  = form.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const originalFilename = `${uuid}.${ext}`;
    const webpFilename     = `${uuid}.webp`;

    const { error: origError } = await supabase.storage
      .from("photos-originals")
      .upload(originalFilename, form.file, {
        contentType: form.file.type, cacheControl: "31536000", upsert: false,
      });
    if (origError) { setSubmitError(origError.message); setSubmitStatus("error"); return; }

    const [thumbBlob, mediumBlob, fullBlob] = await Promise.all([
      resizeImage(form.file, 400,  0.75),
      resizeImage(form.file, 900,  0.82),
      resizeImage(form.file, 1920, 0.90),
    ]);
    await Promise.all([
      supabase.storage.from("photos").upload(`thumb/${webpFilename}`,  thumbBlob,  { contentType: "image/webp", cacheControl: "31536000", upsert: false }),
      supabase.storage.from("photos").upload(`medium/${webpFilename}`, mediumBlob, { contentType: "image/webp", cacheControl: "31536000", upsert: false }),
      supabase.storage.from("photos").upload(`full/${webpFilename}`,   fullBlob,   { contentType: "image/webp", cacheControl: "31536000", upsert: false }),
    ]);

    const { error: insertError } = await supabase.from("photos").insert({
      src: webpFilename,
      title: form.title,
      village: form.village,
      year: form.year,
      description: form.description,
      type: form.type,
      restored: form.restored,
      timeline: form.year,
      status: "pending",
      latitude: form.latitude !== "" ? parseFloat(form.latitude) : null,
      longitude: form.longitude !== "" ? parseFloat(form.longitude) : null,
      user_id: user.id,
    });

    if (insertError) {
      setSubmitError(insertError.message);
      setSubmitStatus("error");
      return;
    }

    // Notifier les admins/modérateurs — échec non bloquant
    fetch(
      "https://fjglbztexnntivdrjhbv.supabase.co/functions/v1/notify-new-photo",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, village: form.village }),
      }
    ).catch((err) => console.warn("[notify-new-photo]", err));

    setForm(defaultForm);
    setShowForm(false);
    setTurnstileToken(null);
    await loadPhotos(user.id);
    setSubmitStatus("success");
  }

  async function handleNotifToggle(value: boolean) {
    if (!user) return;
    setSavingNotif(true);
    setNotifNewPhoto(value);
    await supabase
      .from("profiles")
      .update({ notif_new_photo: value })
      .eq("id", user.id);
    setSavingNotif(false);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar />

      {/* Main content */}
      <main className="px-5 pt-[calc(var(--site-header-height)_+_2rem)] pb-8 md:px-10">
        <div className="max-w-3xl mx-auto">
          {/* Title */}
          <div className="mb-12">
            <h1 className="text-2xl md:text-3xl font-light uppercase tracking-[0.15em] mb-2">
              Tableau de bord
            </h1>
            <p className="text-white/30 text-sm">
              Soumettez des photos et suivez l&apos;état de vos contributions.
            </p>
          </div>

          {/* Submit section */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs uppercase tracking-[0.35em] text-white/50">
                Soumettre une photo
              </h2>
              <button
                onClick={() => {
                  setShowForm(!showForm);
                  setSubmitStatus("idle");
                  setForm(defaultForm);
                }}
                className="px-5 py-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.25em] text-xs hover:bg-cyan-300/20 transition-all"
              >
                {showForm ? "Fermer" : "+ Nouvelle photo"}
              </button>
            </div>

            {showForm && (
              <div className="bg-white/2 border border-white/10 rounded-2xl p-6">
                <p className="text-xs text-white/30 mb-6">
                  Votre photo sera examinée par un modérateur avant d&apos;être
                  publiée sur le site.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Titre</label>
                      <input
                        type="text"
                        required
                        value={form.title}
                        onChange={(e) => setField("title", e.target.value)}
                        placeholder="Ex : Place du village"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Village</label>
                      <select
                        value={form.village}
                        onChange={(e) => setField("village", e.target.value)}
                        className={inputClass}
                      >
                        {villages.map((v) => (
                          <option key={v} value={v} className="bg-zinc-900">
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Année</label>
                      <input
                        type="text"
                        required
                        value={form.year}
                        onChange={(e) => setField("year", e.target.value)}
                        placeholder="Ex : 1965"
                        className={inputClass}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Type</label>
                      <PhotoTypeSelector
                        value={form.type}
                        onChange={(value) => setField("type", value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Description</label>
                    <textarea
                      required
                      rows={3}
                      value={form.description}
                      onChange={(e) =>
                        setField("description", e.target.value)
                      }
                      placeholder="Décrivez la photo, son contexte…"
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Latitude</label>
                      <input type="number" step="any" value={form.latitude}
                        onChange={(e) => setField("latitude", e.target.value)}
                        placeholder="50.727" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Longitude</label>
                      <input type="number" step="any" value={form.longitude}
                        onChange={(e) => setField("longitude", e.target.value)}
                        placeholder="5.958" className={inputClass} />
                    </div>
                  </div>
                  <LocationPicker
                    lat={form.latitude}
                    lng={form.longitude}
                    onChange={(lat, lng) => { setField("latitude", lat); setField("longitude", lng); }}
                  />

                  <div className="flex items-center gap-3">
                    <input
                      id="restored"
                      type="checkbox"
                      checked={form.restored}
                      onChange={(e) => setField("restored", e.target.checked)}
                      className="w-4 h-4 accent-cyan-300 cursor-pointer"
                    />
                    <label
                      htmlFor="restored"
                      className="text-xs uppercase tracking-[0.2em] text-white/60 cursor-pointer"
                    >
                      Photo restaurée
                    </label>
                  </div>

                  <div>
                    <label className={labelClass}>Image</label>
                    <input
                      type="file"
                      required
                      accept="image/*"
                      onChange={(e) =>
                        setField("file", e.target.files?.[0] ?? null)
                      }
                      className="w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-white/20 file:bg-white/5 file:text-white/70 file:text-xs file:uppercase file:tracking-[0.2em] file:cursor-pointer hover:file:bg-white/10 file:transition-all"
                    />
                    {form.file && (
                      <p className="mt-1.5 text-xs text-white/30">
                        {form.file.name}
                      </p>
                    )}
                  </div>

                  {submitStatus === "error" && (
                    <p className="text-red-400 text-xs uppercase tracking-[0.2em]">
                      {submitError}
                    </p>
                  )}

                  <div className="flex justify-center">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                      onSuccess={(token) => { setTurnstileToken(token); if (submitStatus === "error") setSubmitStatus("idle"); }}
                      onExpire={() => setTurnstileToken(null)}
                      options={{ theme: "dark", size: "normal" }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitStatus === "loading" || !turnstileToken}
                    className="px-8 py-3 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.25em] text-xs hover:bg-cyan-300/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitStatus === "loading"
                      ? "Envoi en cours…"
                      : "Soumettre la photo"}
                  </button>
                </form>
              </div>
            )}

            {submitStatus === "success" && !showForm && (
              <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-2xl px-5 py-4">
                <p className="text-emerald-400 text-xs uppercase tracking-[0.25em]">
                  Photo soumise — en attente de validation par un modérateur.
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/5 mb-10" />

          {/* My photos */}
          <div>
            <h2 className="text-xs uppercase tracking-[0.35em] text-white/50 mb-6">
              Mes contributions
            </h2>

            {loadingPhotos ? (
              <p className="text-white/20 uppercase tracking-[0.3em] text-xs py-8">
                Chargement…
              </p>
            ) : photos.length === 0 ? (
              <div className="py-16 border border-white/5 rounded-2xl flex flex-col items-center gap-3">
                <p className="text-white/20 uppercase tracking-[0.3em] text-xs">
                  Aucune photo soumise
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="text-cyan-300/50 hover:text-cyan-300 text-xs uppercase tracking-[0.2em] transition-colors"
                >
                  Soumettre ma première photo →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="flex items-center gap-4 bg-white/2 border border-white/10 rounded-2xl p-3 hover:border-white/20 transition-all"
                  >
                    <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-white/5">
                      <Image
                        src={imageUrl(photo.src, "thumb")}
                        alt={photo.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {photo.title}
                      </p>
                      <p className="text-xs text-white/35 uppercase tracking-[0.15em] mt-0.5">
                        {photo.village} · {photo.year}
                      </p>
                    </div>
                    <StatusBadge status={photo.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Préférences — modérateurs uniquement */}
          {role === "moderator" && (
            <>
              <div className="border-t border-white/5 my-10" />
              <div>
                <h2 className="text-xs uppercase tracking-[0.35em] text-white/50 mb-6">
                  Préférences
                </h2>
                <div className="bg-white/2 border border-white/10 rounded-2xl px-5 py-4">
                  <div className="flex items-center justify-between gap-6">
                    <div className="min-w-0">
                      <p className="text-sm">
                        Notifications — nouvelles photos
                      </p>
                      <p className="text-xs text-white/35 mt-1 leading-relaxed">
                        Recevoir un email à chaque nouvelle photo soumise par
                        un utilisateur.
                      </p>
                    </div>
                    <button
                      onClick={() => handleNotifToggle(!notifNewPhoto)}
                      disabled={savingNotif}
                      aria-label="Activer les notifications"
                      className={`relative shrink-0 w-11 h-6 rounded-full transition-all duration-300 disabled:opacity-50 ${
                        notifNewPhoto ? "bg-cyan-300/80" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                          notifNewPhoto ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
