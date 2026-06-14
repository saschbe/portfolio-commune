"use client";

import { useState, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type L from "leaflet";

// Interface
interface Props {
  lat: string;
  lng: string;
  fallbackCenter?: { lat: number; lng: number };
  referencePoints?: ReferencePoint[];
  defaultFullscreen?: boolean;
  onFullscreenOpened?: () => void;
  onChange: (lat: string, lng: string) => void;
}

type LeafletMap = InstanceType<typeof L.Map>;
type LeafletMarker = InstanceType<typeof L.Marker>;
type ReferencePoint = {
  id: string;
  title: string;
  village: string;
  latitude: number;
  longitude: number;
};

function makeCyanIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    html: `<div style="width:12px;height:12px;background:#67e8f9;border-radius:50%;border:2px solid rgba(8,145,178,0.9);box-shadow:0 0 10px rgba(103,232,249,0.5)"></div>`,
    className: "",
    iconSize: [12, 12] as [number, number],
    iconAnchor: [6, 6] as [number, number],
  });
}

function makeReferenceIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    html: `<div style="width:9px;height:9px;background:rgba(255,255,255,0.9);border-radius:50%;border:2px solid rgba(255,255,255,0.35);box-shadow:0 0 8px rgba(255,255,255,0.45),0 0 0 4px rgba(255,255,255,0.08)"></div>`,
    className: "",
    iconSize: [9, 9] as [number, number],
    iconAnchor: [4.5, 4.5] as [number, number],
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function LocationPicker({
  lat,
  lng,
  fallbackCenter,
  referencePoints = [],
  onChange,
  defaultFullscreen,
  onFullscreenOpened,
}: Props) {
  const miniRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<LeafletMap | null>(null);
  const fullMapRef = useRef<LeafletMap | null>(null);
  const miniMarker = useRef<LeafletMarker | null>(null);
  const fullMarker = useRef<LeafletMarker | null>(null);
  const miniReferenceMarkers = useRef<LeafletMarker[]>([]);
  const fullReferenceMarkers = useRef<LeafletMarker[]>([]);
  const [fullscreen, setFullscreen] = useState(defaultFullscreen ?? false);
  const [mapVersion, setMapVersion] = useState(0);

  const hasCoords = !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
  const fallbackLat = fallbackCenter?.lat ?? 50.727;
  const fallbackLng = fallbackCenter?.lng ?? 5.958;

  // ── Initialiser la mini-carte ──────────────────────────────────────────────
  useEffect(() => {
    if (!miniRef.current || miniMapRef.current) return;
    let alive = true;

    async function init() {
      const L = (await import("leaflet")).default;
      if (!miniRef.current || !alive) return;

      const initLat = parseFloat(lat);
      const initLng = parseFloat(lng);
      const center: [number, number] =
        !isNaN(initLat) && !isNaN(initLng)
          ? [initLat, initLng]
          : [fallbackLat, fallbackLng];

      const map = L.map(miniRef.current, {
        center,
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
      });
      miniMapRef.current = map;

      L.tileLayer(
        `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${process.env.NEXT_PUBLIC_STADIA_API_KEY}`,
        { maxZoom: 20 },
      ).addTo(map);

      L.control
        .attribution({ prefix: false })
        .addAttribution(
          '<span style="font-size:10px;opacity:0.4">© Stadia Maps © OpenStreetMap</span>',
        )
        .addTo(map);

      const icon = makeCyanIcon(L);
      if (!isNaN(initLat) && !isNaN(initLng)) {
        miniMarker.current = L.marker([initLat, initLng], { icon }).addTo(map);
      }

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const { lat: clat, lng: clng } = e.latlng;
        const icon = makeCyanIcon(L);
        if (miniMarker.current) miniMarker.current.setLatLng([clat, clng]);
        else miniMarker.current = L.marker([clat, clng], { icon }).addTo(map);
        // Sync fullscreen marker if open
        if (fullMarker.current) fullMarker.current.setLatLng([clat, clng]);
        else if (fullMapRef.current) {
          fullMarker.current = L.marker([clat, clng], { icon }).addTo(
            fullMapRef.current,
          );
        }
        onChange(clat.toFixed(6), clng.toFixed(6));
      });
      setMapVersion((v) => v + 1);
    }

    init();
    return () => {
      alive = false;
      miniMapRef.current?.remove();
      miniMapRef.current = null;
      miniMarker.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initialiser la carte plein écran quand elle s'ouvre ───────────────────
  useEffect(() => {
    if (!fullscreen) {
      // Détruire la carte fullscreen quand on ferme
      fullMapRef.current?.remove();
      fullMapRef.current = null;
      fullMarker.current = null;
      return;
    }

    // Attendre que le DOM soit rendu
    const timer = setTimeout(async () => {
      if (!fullRef.current || fullMapRef.current) return;

      const L = (await import("leaflet")).default;
      if (!fullRef.current) return;

      const initLat = parseFloat(lat);
      const initLng = parseFloat(lng);
      const center: [number, number] =
        !isNaN(initLat) && !isNaN(initLng)
          ? [initLat, initLng]
          : [fallbackLat, fallbackLng];

      const map = L.map(fullRef.current, {
        center,
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
      });
      fullMapRef.current = map;

      L.tileLayer(
        `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${process.env.NEXT_PUBLIC_STADIA_API_KEY}`,
        { maxZoom: 20 },
      ).addTo(map);

      L.control
        .attribution({ prefix: false })
        .addAttribution(
          '<span style="font-size:10px;opacity:0.4">© Stadia Maps © OpenStreetMap</span>',
        )
        .addTo(map);

      const icon = makeCyanIcon(L);
      if (!isNaN(initLat) && !isNaN(initLng)) {
        fullMarker.current = L.marker([initLat, initLng], { icon }).addTo(map);
      }

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const { lat: clat, lng: clng } = e.latlng;
        const icon = makeCyanIcon(L);
        if (fullMarker.current) fullMarker.current.setLatLng([clat, clng]);
        else fullMarker.current = L.marker([clat, clng], { icon }).addTo(map);
        // Sync mini marker
        if (miniMarker.current) miniMarker.current.setLatLng([clat, clng]);
        else if (miniMapRef.current) {
          miniMarker.current = L.marker([clat, clng], { icon }).addTo(
            miniMapRef.current,
          );
        }
        miniMapRef.current?.setView([clat, clng]);
        onChange(clat.toFixed(6), clng.toFixed(6));
      });

      // Force Leaflet à recalculer la vraie hauteur du conteneur
      requestAnimationFrame(() => map.invalidateSize());
      setTimeout(() => map.invalidateSize(), 150);
      setTimeout(() => map.invalidateSize(), 500);
      setMapVersion((v) => v + 1);
    }, 100);

    return () => clearTimeout(timer);
  }, [fullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync marqueur depuis les inputs externes ───────────────────────────────
  useEffect(() => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) return;

    async function sync(
      mapRef: { current: LeafletMap | null },
      markerRef: { current: LeafletMarker | null },
    ) {
      if (!mapRef.current) return;
      const L = (await import("leaflet")).default;
      const icon = makeCyanIcon(L);
      if (markerRef.current) {
        const cur = markerRef.current.getLatLng();
        if (
          Math.abs(cur.lat - parsedLat) < 0.000001 &&
          Math.abs(cur.lng - parsedLng) < 0.000001
        )
          return;
        markerRef.current.setLatLng([parsedLat, parsedLng]);
      } else {
        markerRef.current = L.marker([parsedLat, parsedLng], { icon }).addTo(
          mapRef.current,
        );
      }
      mapRef.current.setView([parsedLat, parsedLng]);
    }

    sync(miniMapRef, miniMarker);
    if (fullscreen) sync(fullMapRef, fullMarker);
  }, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasCoords || !fallbackCenter) return;
    const center: [number, number] = [fallbackCenter.lat, fallbackCenter.lng];
    miniMapRef.current?.setView(center, 15);
    if (fullscreen) fullMapRef.current?.setView(center, 15);
  }, [fallbackCenter, fullscreen, hasCoords]);

  useEffect(() => {
    async function syncReferenceMarkers(
      mapRef: { current: LeafletMap | null },
      markerRef: { current: LeafletMarker[] },
    ) {
      const map = mapRef.current;
      if (!map) return;

      markerRef.current.forEach((marker) => marker.remove());
      markerRef.current = [];

      if (referencePoints.length === 0) return;

      const L = (await import("leaflet")).default;
      const icon = makeReferenceIcon(L);
      markerRef.current = referencePoints.map((point) => {
        const latStr = point.latitude.toFixed(6);
        const lngStr = point.longitude.toFixed(6);
        return L.marker([point.latitude, point.longitude], {
          icon,
          keyboard: false,
          title: point.title,
        })
          .bindTooltip(
            `<strong>${escapeHtml(point.title || "Photo existante")}</strong><br>${escapeHtml(point.village)}`,
            { direction: "top", opacity: 0.9 },
          )
          .on("click", () => {
            onChange(latStr, lngStr);
            miniMapRef.current?.setView([point.latitude, point.longitude], 17);
            fullMapRef.current?.setView([point.latitude, point.longitude], 17);
          })
          .addTo(map);
      });
    }

    syncReferenceMarkers(miniMapRef, miniReferenceMarkers);
    if (fullscreen) syncReferenceMarkers(fullMapRef, fullReferenceMarkers);

    return () => {
      miniReferenceMarkers.current.forEach((marker) => marker.remove());
      miniReferenceMarkers.current = [];
      fullReferenceMarkers.current.forEach((marker) => marker.remove());
      fullReferenceMarkers.current = [];
    };
  }, [referencePoints, fullscreen, mapVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notifier le parent quand la carte s'ouvre en plein écran
  useEffect(() => {
    if (fullscreen) onFullscreenOpened?.();
  }, [fullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">
        Cliquez sur la carte pour placer le marqueur
        {referencePoints.length > 0
          ? ` - ${referencePoints.length} point${referencePoints.length > 1 ? "s" : ""} existant${referencePoints.length > 1 ? "s" : ""}`
          : ""}
      </p>

      {/* Mini-carte — toujours dans le DOM */}
      <div
        className="relative w-full rounded-xl overflow-hidden border border-white/10"
        style={{ height: "200px" }}
      >
        <div ref={miniRef} className="w-full h-full" />
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm border border-white/20 text-white/60 text-[10px] uppercase tracking-[0.2em] rounded-lg hover:text-white hover:border-white/40 transition-all"
          style={{ zIndex: 1001 }}
        >
          ⛶ Plein écran
        </button>
      </div>

      {/* Plein écran — monté/démonté dynamiquement */}
      {fullscreen && (
        <div
          className="fixed inset-0 bg-black"
          style={{ zIndex: 99999, width: "100vw", height: "100vh" }}
        >
          <div ref={fullRef} style={{ width: "100%", height: "100%" }} />{" "}
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 px-5 py-2 bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs uppercase tracking-[0.25em] rounded-full hover:border-cyan-300/40 hover:text-cyan-300 transition-all"
            style={{ zIndex: 10000 }}
          >
            ✕ Fermer
          </button>
        </div>
      )}
    </div>
  );
}
