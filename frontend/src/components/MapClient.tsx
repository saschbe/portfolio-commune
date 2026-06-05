"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type L from "leaflet";
import { supabase } from "@/lib/supabase";
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

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<InstanceType<typeof L.Map> | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let alive = true;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      if (!containerRef.current || !alive) return;

      const map = L.map(containerRef.current, {
        center: [50.727, 5.958],
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
      });
      mapRef.current = map;

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
          .select("id, src, title, village, description, latitude, longitude")
          .eq("status", "approved")
          .not("latitude", "is", null)
          .not("longitude", "is", null),
      ]);

      if (!alive) return;

      const clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 50,
        iconCreateFunction: (cluster: { getChildCount(): number }) => {
          const n = cluster.getChildCount();
          const size = n < 10 ? 36 : n < 50 ? 46 : 56;
          return L.divIcon({
            html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(8,145,178,0.25);border:2px solid rgba(103,232,249,0.7);border-radius:50%;box-shadow:0 0 16px rgba(103,232,249,0.5),0 0 0 6px rgba(103,232,249,0.1);backdrop-filter:blur(4px);color:#67e8f9;font-size:13px;font-weight:600">${n}</div>`,
            className: "",
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
        },
      });

      for (const l of (lieux ?? []) as Lieu[]) {
        L.marker([l.latitude, l.longitude], { icon: cyanIcon })
          .bindPopup(
            popupHtml({
              label: l.type,
              title: l.nom,
              village: l.village,
              description: l.description,
            }),
            popupOpts,
          )
          .addTo(clusterGroup);
      }

      for (const p of (photos ?? []) as Photo[]) {
        L.marker([p.latitude, p.longitude], { icon: whiteIcon })
          .bindPopup(
            photoPopupHtml({
              id: p.id,
              src: p.src,
              title: p.title,
              village: p.village,
              description: p.description,
            }),
            { ...popupOpts, maxWidth: 240 },
          )
          .addTo(clusterGroup);
      }

      map.addLayer(clusterGroup);
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
