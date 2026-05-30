"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type L from "leaflet";

interface Props {
  latitude: number;
  longitude: number;
}

export default function PhotoMap({ latitude, longitude }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<InstanceType<typeof L.Map> | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let alive = true;

    async function init() {
      const L = (await import("leaflet")).default;
      if (!containerRef.current || !alive) return;

      const map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
        { maxZoom: 20 }
      ).addTo(map);

      L.control
        .attribution({ prefix: false })
        .addAttribution('<span style="font-size:10px;opacity:0.4">© Stadia Maps © OpenStreetMap</span>')
        .addTo(map);

      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#67e8f9;border-radius:50%;border:2px solid rgba(8,145,178,0.9);box-shadow:0 0 12px rgba(103,232,249,0.55),0 0 0 5px rgba(103,232,249,0.12)"></div>`,
        className: "",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([latitude, longitude], { icon }).addTo(map);
    }

    init();

    return () => {
      alive = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude]);

  return <div ref={containerRef} className="w-full h-full" />;
}
