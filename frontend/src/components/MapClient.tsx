"use client";

import { useState, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type L from "leaflet";
import { imageUrl } from "@/lib/imageUrl";

type Lieu = {
  id: string;
  nom: string;
  village: string;
  type: string;
  description: string;
  latitude: number;
  longitude: number;
};

type Photo = {
  id: string;
  src: string;
  title: string;
  village: string;
  description: string;
  latitude: number;
  longitude: number;
};

type Props = {
  photos: Photo[];
  lieux: Lieu[];
};

function photoPopupHtml(opts: {
  id: string;
  src: string;
  title: string;
  village: string;
  description: string;
}) {
  const thumbUrl = imageUrl(opts.src, "thumb");
  return `
    <div style="width:220px;padding:14px">
      <div style="width:100%;height:140px;border-radius:8px;overflow:hidden;margin-bottom:10px;background:rgba(255,255,255,0.05)">
        <img src="${thumbUrl}" alt="${opts.title}" style="width:100%;height:100%;object-fit:cover" />
      </div>
      <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:rgba(103,232,249,0.7)">Photo</p>
      <p style="margin:0 0 3px;font-size:14px;font-weight:500;color:#fff;line-height:1.3">${opts.title}</p>
      <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.35)">${opts.village}</p>
      ${opts.description ? `<p style="margin:0 0 10px;font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5">${opts.description}</p>` : ""}
      <a href="/photo/${opts.id}?from=carte" style="display:inline-block;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#67e8f9;text-decoration:none;border:1px solid rgba(103,232,249,0.3);padding:6px 12px;border-radius:9999px">Voir la photo →</a>
    </div>`;
}

function popupHtml(opts: {
  label: string;
  title: string;
  village: string;
  description: string;
}) {
  return `
    <div style="padding:12px 14px;min-width:180px;max-width:220px">
      <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:rgba(103,232,249,0.7)">${opts.label}</p>
      <p style="margin:0 0 3px;font-size:14px;font-weight:500;color:#fff;line-height:1.3">${opts.title}</p>
      <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.35)">${opts.village}</p>
      ${opts.description ? `<p style="margin:0;font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5">${opts.description}</p>` : ""}
    </div>`;
}

const STADIA_KEY = process.env.NEXT_PUBLIC_STADIA_API_KEY;
function tileUrl(style: "dark" | "light") {
  const layer = style === "dark" ? "alidade_smooth_dark" : "osm_bright";
  return `https://tiles.stadiamaps.com/tiles/${layer}/{z}/{x}/{y}{r}.png?api_key=${STADIA_KEY}`;
}

export default function MapClient({ photos, lieux }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<InstanceType<typeof L.Map> | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  const [mapStyle, setMapStyle] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const s = localStorage.getItem("map-style");
    return s === "light" ? "light" : "dark";
  });

  const [mapReady, setMapReady] = useState(false);

  // Swap tile layer without touching markers
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const old = tileRef.current;
    if (!L || !map || !old) return;
    map.removeLayer(old);
    tileRef.current = L.tileLayer(tileUrl(mapStyle), { maxZoom: 20 }).addTo(map);
    localStorage.setItem("map-style", mapStyle);
  }, [mapStyle]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let alive = true;

    async function init() {
      const L = (await import("leaflet")).default;
      leafletRef.current = L;
      await import("leaflet.markercluster");
      if (!containerRef.current || !alive) return;

      const map = L.map(containerRef.current, {
        center: [50.727, 5.958],
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
      });
      mapRef.current = map;

      tileRef.current = L.tileLayer(tileUrl(mapStyle), { maxZoom: 20 }).addTo(map);

      L.control
        .attribution({ prefix: false })
        .addAttribution(
          '<span style="font-size:10px;opacity:0.4">© Stadia Maps © OpenStreetMap</span>',
        )
        .addTo(map);

      if (alive) setMapReady(true);
    }

    init();

    return () => {
      alive = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        clusterRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild markers whenever filtered data changes
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current.clearLayers();
    }

    const cyanIcon = L.divIcon({
      html: `<div style="width:14px;height:14px;background:#67e8f9;border-radius:50%;border:2px solid rgba(8,145,178,0.9);box-shadow:0 0 12px rgba(103,232,249,0.55),0 0 0 5px rgba(103,232,249,0.12)"></div>`,
      className: "",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -12],
    });

    const whiteIcon = L.divIcon({
      html: `<div style="width:10px;height:10px;background:rgba(255,255,255,0.92);border-radius:50%;border:2px solid rgba(255,255,255,0.3);box-shadow:0 0 8px rgba(255,255,255,0.4),0 0 0 4px rgba(255,255,255,0.08)"></div>`,
      className: "",
      iconSize: [10, 10],
      iconAnchor: [5, 5],
      popupAnchor: [0, -9],
    });

    const popupOpts = { className: "leaflet-popup-dark", maxWidth: 260 };

    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster: { getChildCount(): number }) => {
        const n = cluster.getChildCount();
        const size = n < 10 ? 36 : n < 50 ? 46 : 56;
        return L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;
            display:flex;align-items:center;justify-content:center;
            background:rgba(8,145,178,0.85);
            border:2px solid rgba(103,232,249,0.9);
            border-radius:50%;
            box-shadow:0 0 16px rgba(8,145,178,0.4);
            color:#ffffff;font-size:14px;font-weight:700;
          ">${n}</div>`,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });
    clusterRef.current = clusterGroup;

    for (const l of lieux) {
      L.marker([l.latitude, l.longitude], { icon: cyanIcon })
        .bindPopup(
          popupHtml({ label: l.type, title: l.nom, village: l.village, description: l.description }),
          popupOpts,
        )
        .addTo(clusterGroup);
    }

    for (const p of photos) {
      L.marker([p.latitude, p.longitude], { icon: whiteIcon })
        .bindPopup(
          photoPopupHtml({ id: p.id, src: p.src, title: p.title, village: p.village, description: p.description }),
          { ...popupOpts, maxWidth: 240 },
        )
        .addTo(clusterGroup);
    }

    map.addLayer(clusterGroup);
  }, [photos, lieux, mapReady]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div
        style={{ top: "calc(var(--site-header-height) + 1rem)" }}
        className="absolute right-4 z-[800] flex rounded-full overflow-hidden border border-white/20 bg-black/80 backdrop-blur-md shadow-lg"
      >
        <button
          onClick={() => setMapStyle("dark")}
          className={`px-4 py-2 text-[10px] uppercase tracking-[0.2em] transition-all ${
            mapStyle === "dark"
              ? "bg-cyan-300/15 text-cyan-300"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          Sombre
        </button>
        <button
          onClick={() => setMapStyle("light")}
          className={`px-4 py-2 text-[10px] uppercase tracking-[0.2em] transition-all ${
            mapStyle === "light"
              ? "bg-cyan-300/15 text-cyan-300"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          Clair
        </button>
      </div>
    </div>
  );
}
