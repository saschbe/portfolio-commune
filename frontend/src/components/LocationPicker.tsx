"use client";

import { useState, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type L from "leaflet";

interface Props {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
}

type LeafletMap    = InstanceType<typeof L.Map>;
type LeafletMarker = InstanceType<typeof L.Marker>;

function makeCyanIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    html: `<div style="width:12px;height:12px;background:#67e8f9;border-radius:50%;border:2px solid rgba(8,145,178,0.9);box-shadow:0 0 10px rgba(103,232,249,0.5)"></div>`,
    className: "",
    iconSize:   [12, 12] as [number, number],
    iconAnchor: [6,  6]  as [number, number],
  });
}

export default function LocationPicker({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap    | null>(null);
  const markerRef    = useRef<LeafletMarker | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Initialiser la carte une seule fois
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let alive = true;

    async function init() {
      const L = (await import("leaflet")).default;
      if (!containerRef.current || !alive) return;

      const initLat = parseFloat(lat);
      const initLng = parseFloat(lng);
      const center: [number, number] =
        !isNaN(initLat) && !isNaN(initLng) ? [initLat, initLng] : [50.727, 5.958];

      const map = L.map(containerRef.current, { center, zoom: 14, zoomControl: true, attributionControl: false });
      mapRef.current = map;

      L.tileLayer(
        "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
        { maxZoom: 20 }
      ).addTo(map);

      L.control.attribution({ prefix: false })
        .addAttribution('<span style="font-size:10px;opacity:0.4">© Stadia Maps © OpenStreetMap</span>')
        .addTo(map);

      const icon = makeCyanIcon(L);

      if (!isNaN(initLat) && !isNaN(initLng)) {
        markerRef.current = L.marker([initLat, initLng], { icon }).addTo(map);
      }

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          markerRef.current = L.marker([clickLat, clickLng], { icon }).addTo(map);
        }
        onChange(clickLat.toFixed(6), clickLng.toFixed(6));
      });
    }

    init();

    return () => {
      alive = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recalculer la taille de la carte quand le mode plein écran change
  useEffect(() => {
    if (!mapRef.current) return;
    const timer = setTimeout(() => mapRef.current?.invalidateSize(), 50);
    return () => clearTimeout(timer);
  }, [fullscreen]);

  // Déplacer le marqueur quand lat/lng changent depuis les inputs
  useEffect(() => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng) || !mapRef.current) return;

    if (markerRef.current) {
      const cur = markerRef.current.getLatLng();
      if (
        Math.abs(cur.lat - parsedLat) < 0.000001 &&
        Math.abs(cur.lng - parsedLng) < 0.000001
      ) return;
    }

    async function updateMarker() {
      const L = (await import("leaflet")).default;
      if (!mapRef.current) return;
      const icon = makeCyanIcon(L);
      if (markerRef.current) {
        markerRef.current.setLatLng([parsedLat, parsedLng]);
      } else {
        markerRef.current = L.marker([parsedLat, parsedLng], { icon }).addTo(mapRef.current);
      }
      mapRef.current.setView([parsedLat, parsedLng]);
    }

    updateMarker();
  }, [lat, lng]);

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">
        Cliquez sur la carte pour placer le marqueur
      </p>

      {/* Wrapper — mini ou plein écran */}
      <div
        className={
          fullscreen
            ? "fixed inset-0 z-9999 bg-black"
            : "relative w-full rounded-xl overflow-hidden border border-white/10"
        }
        style={fullscreen ? {} : { height: "200px" }}
      >
        {/* Conteneur Leaflet — toujours pleine taille du wrapper */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Bouton plein écran (mode mini) */}
        {!fullscreen && (
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm border border-white/20 text-white/60 text-[10px] uppercase tracking-[0.2em] rounded-lg hover:text-white hover:border-white/40 transition-all"
            style={{ zIndex: 1001 }}
          >
            ⛶ Plein écran
          </button>
        )}

        {/* Bouton Fermer (mode plein écran) */}
        {fullscreen && (
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 px-5 py-2 bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs uppercase tracking-[0.25em] rounded-full hover:border-cyan-300/40 hover:text-cyan-300 transition-all"
            style={{ zIndex: 1001 }}
          >
            ✕ Fermer
          </button>
        )}
      </div>
    </div>
  );
}
