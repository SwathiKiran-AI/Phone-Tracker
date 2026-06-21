import React, { useEffect, useRef, useState } from "react";
import { Compass, ZoomIn, ZoomOut, Navigation, Map, Layers } from "lucide-react";
import { TrackingLocation } from "../types";

interface TrackingMapProps {
  location: TrackingLocation;
  ownerName: string;
}

export default function TrackingMap({ location, ownerName }: TrackingMapProps) {
  const [zoom, setZoom] = useState<number>(3.0);
  const [mapMode, setMapMode] = useState<"standard" | "satellite" | "hybrid">("hybrid");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [dimensions, setDimensions] = useState({ width: 720, height: 330 });

  // Dynamic script/style injection of Leaflet
  useEffect(() => {
    const cssId = "leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }

    const jsId = "leaflet-js";
    if (!document.getElementById(jsId)) {
      const script = document.createElement("script");
      script.id = jsId;
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.async = true;
      script.onload = () => setIsLoaded(true);
      document.body.appendChild(script);
    } else {
      if ((window as any).L) {
        setIsLoaded(true);
      } else {
        const interval = setInterval(() => {
          if ((window as any).L) {
            setIsLoaded(true);
            clearInterval(interval);
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }
  }, []);

  // Initialize Map Instance on target coordinates when loaded
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    const calcLeafletZoom = (z: number) => {
      // Scale from zoom state (1.2 to 6.0) to Leaflet zoom levels (11 to 18)
      return Math.round(11 + (z - 1.2) * (7 / 4.8));
    };

    const initialZoom = calcLeafletZoom(zoom);

    // Create map
    const map = L.map(mapContainerRef.current, {
      center: [location.latitude, location.longitude],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: true,
    });

    mapInstanceRef.current = map;

    // Define tile layers
    let tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    if (mapMode === "satellite" || mapMode === "hybrid") {
      tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    }

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Custom pulsing marker pin represent GPS beacon
    const trackingIcon = L.divIcon({
      className: '',
      html: `
        <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 44px; height: 44px; background: rgba(245, 158, 11, 0.2); border: 2px dashed rgba(245, 158, 11, 0.6); border-radius: 9999px; animation: ping 1.5s infinite;"></div>
          <div style="position: absolute; width: 14px; height: 14px; background: #eab308; border: 2px solid #ffffff; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.45);"></div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const marker = L.marker([location.latitude, location.longitude], { icon: trackingIcon }).addTo(map);
    markerRef.current = marker;

    // Circle of accuracy
    const circle = L.circle([location.latitude, location.longitude], {
      color: mapMode === "standard" ? "#d97706" : "#22c55e",
      fillColor: mapMode === "standard" ? "#f59e0b" : "#22c55e",
      fillOpacity: 0.12,
      weight: 1.5,
      radius: location.accuracyMeters * 4,
    }).addTo(map);
    circleRef.current = circle;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      tileLayerRef.current = null;
    };
  }, [isLoaded, dimensions.width, dimensions.height]); // Re-render when size snaps

  // Sync coordinate changes, zooms, and map modes dynamically
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const calcLeafletZoom = (z: number) => {
      return Math.round(11 + (z - 1.2) * (7 / 4.8));
    };

    const targetZoom = calcLeafletZoom(zoom);
    map.setView([location.latitude, location.longitude], targetZoom);

    if (markerRef.current) {
      markerRef.current.setLatLng([location.latitude, location.longitude]);
    }

    if (circleRef.current) {
      circleRef.current.setLatLng([location.latitude, location.longitude]);
      circleRef.current.setRadius(location.accuracyMeters * 4);
      circleRef.current.setStyle({
        color: mapMode === "standard" ? "#d97706" : "#10b981",
        fillColor: mapMode === "standard" ? "#f59e0b" : "#10b981",
      });
    }

    if (tileLayerRef.current) {
      let tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      if (mapMode === "satellite" || mapMode === "hybrid") {
        tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      }
      tileLayerRef.current.setUrl(tileUrl);
    }
  }, [location.latitude, location.longitude, location.accuracyMeters, zoom, mapMode, isLoaded]);

  // Overlay HUD scanning lines (Super-crisp Canvas over map context)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dimensions.width || 720;
    const h = dimensions.height || 330;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    let radarAngle = 0;

    const drawScan = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;

      // 1. Sweeping scanner overlay
      radarAngle += 0.015;
      const sweepColor = mapMode === "standard" ? "rgba(245, 158, 11, 0.04)" : "rgba(34, 197, 94, 0.05)";
      const sweepGradient = ctx.createRadialGradient(cx, cy, 5, cx, cy, 280);
      sweepGradient.addColorStop(0, sweepColor);
      sweepGradient.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = sweepGradient;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 280, radarAngle, radarAngle + 0.45);
      ctx.closePath();
      ctx.fill();

      // 2. Telemetry Rangefinder Rings
      ctx.strokeStyle = mapMode === "standard" ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.2)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, 60, 0, Math.PI * 2);
      ctx.arc(cx, cy, 120, 0, Math.PI * 2);
      ctx.arc(cx, cy, 200, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair markers
      ctx.strokeStyle = mapMode === "standard" ? "rgba(245, 158, 11, 0.25)" : "rgba(34, 197, 94, 0.35)";
      ctx.lineWidth = 1;
      
      // Top hash
      ctx.beginPath(); ctx.moveTo(cx, cy - 215); ctx.lineTo(cx, cy - 200); ctx.stroke();
      // Bottom hash
      ctx.beginPath(); ctx.moveTo(cx, cy + 200); ctx.lineTo(cx, cy + 215); ctx.stroke();
      // Left hash
      ctx.beginPath(); ctx.moveTo(cx - 215, cy); ctx.lineTo(cx - 200, cy); ctx.stroke();
      // Right hash
      ctx.beginPath(); ctx.moveTo(cx + 200, cy); ctx.lineTo(cx + 215, cy); ctx.stroke();

      animationRef.current = requestAnimationFrame(drawScan);
    };

    drawScan();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, mapMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: width || 720, height: height || 330 });
      if (mapInstanceRef.current) {
        // Redraw or invalidate size on Leaflet wrapper
        setTimeout(() => {
          if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
        }, 120);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-[330px] rounded-2xl border border-zinc-200 bg-zinc-150 overflow-hidden shadow-sm flex flex-col justify-end">
      
      {/* Dynamic Leaflet Target Map Base */}
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0 z-0 bg-zinc-900" 
        style={{ width: "100%", height: "100%" }}
      />

      {/* Military Sweeping & Triangulation radar lines overlay */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-10 w-full h-full object-cover"
      />

      {/* Top Left Status Info overlay */}
      <div className="absolute top-3 left-3 bg-white/95 border border-zinc-200 px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-sm backdrop-blur-md z-20 transition">
        <Navigation className="w-4 h-4 text-amber-500 animate-pulse rotate-45" />
        <div>
          <span className="text-[9px] font-mono font-bold text-zinc-800 uppercase tracking-wider block">
            {mapMode === "standard" ? "TOKYO-US VECTOR LAND GRID" : mapMode === "satellite" ? "LIVE TELEMETRY COLD SATELLITE" : "AUTONOMOUS TRILATERATION FEED"}
          </span>
          <span className="text-[8px] text-zinc-500 font-mono block">SIGNAL MAPPED VIA HYBRID LOCALIZATION PIN</span>
        </div>
      </div>

      {/* Map Mode selector buttons */}
      <div className="absolute top-3 right-3 bg-white/95 border border-zinc-200 p-1 rounded-xl flex items-center space-x-0.5 shadow-sm backdrop-blur-md z-20">
        <button
          onClick={() => setMapMode("standard")}
          className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg transition-all font-mono cursor-pointer ${
            mapMode === "standard"
              ? "bg-amber-500 text-zinc-950 shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Grid
        </button>
        <button
          onClick={() => setMapMode("satellite")}
          className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg transition-all font-mono cursor-pointer ${
            mapMode === "satellite"
              ? "bg-amber-500 text-zinc-950 shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Satellite
        </button>
        <button
          onClick={() => setMapMode("hybrid")}
          className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-lg transition-all font-mono cursor-pointer ${
            mapMode === "hybrid"
              ? "bg-amber-500 text-zinc-950 shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Hybrid
        </button>
      </div>

      {/* Zoom control buttons */}
      <div className="absolute bottom-3 right-3 flex items-center space-x-1.5 z-20">
        <button
          onClick={() => setZoom((prev) => Math.min(prev + 0.6, 6.0))}
          className="p-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-amber-500 rounded-lg shadow-sm transition cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((prev) => Math.max(prev - 0.6, 1.2))}
          className="p-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-amber-500 rounded-lg shadow-sm transition cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Target coordinates and diagnostic data panel under-lay */}
      <div className="absolute bottom-3 left-3 bg-white/95 border border-zinc-200 px-3 py-2 rounded-xl text-[10px] font-mono text-zinc-700 shadow-sm z-20 backdrop-blur-md space-y-1 block max-w-[280px]">
        <div className="font-bold text-zinc-900 border-b border-zinc-100 pb-1 mb-1">
          GPS TELEMETRY TARGET
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500 uppercase">Marker:</span>
          <span className="font-bold text-zinc-800">{ownerName}'s Lost Phone</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500 uppercase">Latitude:</span>
          <span className="font-bold text-zinc-800">{location.latitude.toFixed(6)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500 uppercase">Longitude:</span>
          <span className="font-bold text-zinc-800">{location.longitude.toFixed(6)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500 uppercase">Precision:</span>
          <span className="font-bold text-amber-600 animate-pulse">±{location.accuracyMeters} METERS</span>
        </div>
      </div>
    </div>
  );
}
