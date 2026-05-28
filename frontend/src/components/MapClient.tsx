"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type L from "leaflet";
import { supabase } from "@/lib/supabase";

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
  title: string;
  village: string;
  description: string;
  latitude: number;
  longitude: number;
};

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

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<InstanceType<typeof L.Map> | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let alive = true;

    async function init() {
      const L = (await import("leaflet")).default;
      if (!containerRef.current || !alive) return;

      const map = L.map(containerRef.current, {
        center: [50.727, 5.958],
        zoom: 13,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
        {
          attribution: "© Stadia Maps © OpenStreetMap",
          maxZoom: 20,
        }
      ).addTo(map);

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

      const [{ data: lieux }, { data: photos }] = await Promise.all([
        supabase
          .from("lieux")
          .select("id, nom, village, type, description, latitude, longitude")
          .not("latitude", "is", null)
          .not("longitude", "is", null),
        supabase
          .from("photos")
          .select("id, title, village, description, latitude, longitude")
          .eq("status", "approved")
          .not("latitude", "is", null)
          .not("longitude", "is", null),
      ]);

      if (!alive) return;

      for (const l of (lieux ?? []) as Lieu[]) {
        L.marker([l.latitude, l.longitude], { icon: cyanIcon })
          .bindPopup(
            popupHtml({
              label: l.type,
              title: l.nom,
              village: l.village,
              description: l.description,
            }),
            popupOpts
          )
          .addTo(map);
      }

      for (const p of (photos ?? []) as Photo[]) {
        L.marker([p.latitude, p.longitude], { icon: whiteIcon })
          .bindPopup(
            popupHtml({
              label: "Photo",
              title: p.title,
              village: p.village,
              description: p.description,
            }),
            popupOpts
          )
          .addTo(map);
      }
    }

    init();

    return () => {
      alive = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
